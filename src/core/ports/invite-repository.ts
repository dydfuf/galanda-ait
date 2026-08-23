import { Context } from "effect";
import type { InviteToken, ParticipantId, TripId } from "../domain/ids.ts";
import type { RepositoryEffect } from "./repository.ts";

export interface InviteRecord {
  readonly tripId: TripId;
  readonly inviterName: string;
}

export interface IssueInviteParams extends InviteRecord {
  readonly token: InviteToken;
  readonly issuedByParticipantId: ParticipantId;
  readonly expiresAt: string;
}

export class InviteRepository extends Context.Service<
  InviteRepository,
  {
    readonly issue: (params: IssueInviteParams) => RepositoryEffect<void>;
    readonly findValid: (
      token: InviteToken,
      now: Date
    ) => RepositoryEffect<InviteRecord | undefined>;
    readonly revoke: (tripId: TripId) => RepositoryEffect<void>;
  }
>()("galanda/ports/InviteRepository") {}
