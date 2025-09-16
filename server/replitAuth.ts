import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

// Validate required environment variables at startup
if (!process.env.REPLIT_DOMAINS) {
  throw new Error("Environment variable REPLIT_DOMAINS not provided");
}

if (!process.env.DATABASE_URL) {
  console.error("CRITICAL: Environment variable DATABASE_URL is missing");
  throw new Error("Environment variable DATABASE_URL is required for session storage");
}

if (!process.env.SESSION_SECRET) {
  console.error("CRITICAL: Environment variable SESSION_SECRET is missing");
  throw new Error("Environment variable SESSION_SECRET is required for secure sessions");
}

console.log("✓ All required environment variables validated successfully");

const getOidcConfig = memoize(
  async () => {
    console.log('Getting OIDC config with ISSUER_URL:', process.env.ISSUER_URL ?? "https://replit.com/oidc");
    console.log('REPL_ID:', process.env.REPL_ID ? 'present' : 'missing');
    try {
      const config = await client.discovery(
        new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
        process.env.REPL_ID!
      );
      console.log('OIDC config successfully retrieved');
      return config;
    } catch (error) {
      console.error('Failed to get OIDC config:', error);
      throw error;
    }
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: 'auto',
      sameSite: 'lax',
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(
  claims: any,
) {
  console.log('Upserting user with claims:', claims);
  await storage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    console.log('OAuth verify function called with tokens');
    try {
      const user = {};
      updateUserSession(user, tokens);
      await upsertUser(tokens.claims());
      console.log('User successfully authenticated and upserted');
      verified(null, user);
    } catch (error) {
      console.error('Error in OAuth verify function:', error);
      verified(error, null);
    }
  };

  // Function to create strategy with dynamic callback URL
  const createStrategy = (callbackURL: string) => {
    console.log('Creating strategy with dynamic callback URL:', callbackURL);
    return new Strategy(
      {
        name: "replitauth",
        config,
        scope: "openid email profile offline_access",
        callbackURL: callbackURL,
      },
      verify,
    );
  };

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    console.log('Starting OAuth login flow for hostname:', req.hostname);
    
    try {
      // Create dynamic callback URL based on current request
      const callbackURL = `${req.protocol}://${req.get('host')}/api/callback`;
      const strategy = createStrategy(callbackURL);
      
      // Use consistent strategy name 
      const strategyName = "replitauth-dynamic";
      strategy.name = strategyName;
      passport.use(strategyName, strategy);
      
      passport.authenticate(strategyName, {
        prompt: "login consent",
        scope: ["openid", "email", "profile", "offline_access"],
      })(req, res, next);
    } catch (error) {
      console.error('Error in passport.authenticate:', error);
      res.status(500).json({ error: 'Authentication failed', details: error.message });
    }
  });

  app.get("/api/callback", (req, res, next) => {
    console.log('Processing OAuth callback for hostname:', req.hostname);
    
    try {
      // Create dynamic callback URL based on current request  
      const callbackURL = `${req.protocol}://${req.get('host')}/api/callback`;
      const strategy = createStrategy(callbackURL);
      
      // Use consistent strategy name for callback
      const strategyName = "replitauth-dynamic";
      strategy.name = strategyName;
      passport.use(strategyName, strategy);
      
      passport.authenticate(strategyName, {
        successReturnToOrRedirect: "/",
        failureRedirect: "/api/login",
      })(req, res, next);
    } catch (error) {
      console.error('Error in callback authentication:', error);
      res.status(500).json({ error: 'Callback authentication failed', details: error.message });
    }
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href
      );
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  if (!req.isAuthenticated() || !user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};