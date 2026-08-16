import { ManagedRuntime } from "effect";
import { AppLayer } from "./app-layer.ts";

export const appRuntime = ManagedRuntime.make(AppLayer);
