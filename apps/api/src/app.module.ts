import { Module } from '@nestjs/common';

// Module map (owner: Core Backend unless noted). Each folder in ./modules is one bounded context.
// auth · rbac · tenancy · orgs · entitlements · audit            (S1)
// templates · assessments · candidates · assignments · ai-keys   (S2)
// workspaces · consent · timing                                  (S3, with Candidate & Workspace)
// submissions · reviews                                          (S4, with AI Engineering)
// billing · quotes · leads · analytics · retention · webhooks    (S5)
@Module({
  imports: [],
})
export class AppModule {}
