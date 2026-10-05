export {};

declare module "skybridge/server" {
  interface ViewNameRegistry {
    "browse": true;
    "diagnostics": true;
    "discover": true;
    "film": true;
    "live": true;
    "player": true;
    "recommend": true;
    "reel": true;
  }
}
