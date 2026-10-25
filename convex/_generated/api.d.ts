/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as events from "../events.js";
import type * as export_ from "../export.js";
import type * as lib_blocklist from "../lib/blocklist.js";
import type * as lib_csv from "../lib/csv.js";
import type * as lib_password from "../lib/password.js";
import type * as lib_requireModerator from "../lib/requireModerator.js";
import type * as messages from "../messages.js";
import type * as moderation from "../moderation.js";
import type * as participants from "../participants.js";
import type * as polls from "../polls.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  events: typeof events;
  export: typeof export_;
  "lib/blocklist": typeof lib_blocklist;
  "lib/csv": typeof lib_csv;
  "lib/password": typeof lib_password;
  "lib/requireModerator": typeof lib_requireModerator;
  messages: typeof messages;
  moderation: typeof moderation;
  participants: typeof participants;
  polls: typeof polls;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
