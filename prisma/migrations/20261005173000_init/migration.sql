-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerLocationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "countryCode" TEXT,
    "region" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "timezone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForecastSnapshot" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "weatherAvailable" BOOLEAN NOT NULL,
    "marineAvailable" BOOLEAN NOT NULL,

    CONSTRAINT "ForecastSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForecastDay" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "localDate" DATE NOT NULL,
    "minTemperature" DOUBLE PRECISION,
    "maxTemperature" DOUBLE PRECISION,
    "precipitationProbabilityMax" DOUBLE PRECISION,
    "precipitationSum" DOUBLE PRECISION,
    "rainSum" DOUBLE PRECISION,
    "snowfallSum" DOUBLE PRECISION,
    "maxWindSpeed" DOUBLE PRECISION,
    "weatherCode" INTEGER,
    "sunshineDuration" DOUBLE PRECISION,
    "maxWaveHeight" DOUBLE PRECISION,
    "maxWavePeriod" DOUBLE PRECISION,
    "maxWindWaveHeight" DOUBLE PRECISION,
    "maxSwellHeight" DOUBLE PRECISION,
    "maxSwellPeriod" DOUBLE PRECISION,

    CONSTRAINT "ForecastDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Location_name_idx" ON "Location"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Location_provider_providerLocationId_key" ON "Location"("provider", "providerLocationId");

-- CreateIndex
CREATE INDEX "ForecastSnapshot_locationId_fetchedAt_idx" ON "ForecastSnapshot"("locationId", "fetchedAt" DESC);

-- CreateIndex
CREATE INDEX "ForecastDay_snapshotId_localDate_idx" ON "ForecastDay"("snapshotId", "localDate");

-- CreateIndex
CREATE UNIQUE INDEX "ForecastDay_snapshotId_localDate_key" ON "ForecastDay"("snapshotId", "localDate");

-- AddForeignKey
ALTER TABLE "ForecastSnapshot" ADD CONSTRAINT "ForecastSnapshot_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForecastDay" ADD CONSTRAINT "ForecastDay_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "ForecastSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
