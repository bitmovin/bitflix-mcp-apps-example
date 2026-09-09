export {};

declare module "skybridge/server" {
  interface ViewNameRegistry {
    "browse": true;
    "diagnostics": true;
    "live": true;
    "player": true;
    "recommend": true;
  }
}
