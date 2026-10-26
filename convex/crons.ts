import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval("prune old reactions", { seconds: 60 }, internal.reactions.pruneOldReactions);

export default crons;
