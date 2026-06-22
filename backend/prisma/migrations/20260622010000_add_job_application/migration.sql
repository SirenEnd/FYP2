-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ApplicantPosition" AS ENUM ('KITCHEN_STAFF', 'SERVICE_CREW');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ApplicationStatus" AS ENUM ('PENDING', 'REVIEWED', 'CONTACTED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "JobApplication" (
    "id"                SERIAL NOT NULL,
    "name"              TEXT NOT NULL,
    "email"             TEXT NOT NULL,
    "phone"             TEXT NOT NULL,
    "address"           TEXT NOT NULL,
    "position"          "ApplicantPosition" NOT NULL,
    "typhoidVaccinated" BOOLEAN NOT NULL,
    "vaccinationYear"   INTEGER,
    "status"            "ApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy"        INTEGER,
    "reviewedAt"        TIMESTAMP(3),
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobApplication_pkey" PRIMARY KEY ("id")
);