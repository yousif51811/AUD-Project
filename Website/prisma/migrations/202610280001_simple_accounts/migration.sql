ALTER TABLE "User" ADD COLUMN "username" TEXT;
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
ALTER TABLE "FamilyInvitation" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'MEMBER';
