-- CreateTable
CREATE TABLE "public"."remix_text_styles" (
    "id" TEXT NOT NULL,
    "remixId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "fontSize" INTEGER NOT NULL DEFAULT 24,
    "fontFamily" TEXT NOT NULL DEFAULT 'Poppins',
    "fontWeight" TEXT NOT NULL DEFAULT 'normal',
    "fontStyle" TEXT NOT NULL DEFAULT 'normal',
    "textDecoration" TEXT NOT NULL DEFAULT 'none',
    "color" TEXT NOT NULL DEFAULT '#000000',
    "textAlign" TEXT NOT NULL DEFAULT 'center',
    "enableShadow" BOOLEAN NOT NULL DEFAULT false,
    "shadowColor" TEXT,
    "shadowBlur" INTEGER,
    "shadowOffsetX" INTEGER,
    "shadowOffsetY" INTEGER,
    "outlineWidth" INTEGER NOT NULL DEFAULT 0,
    "outlineColor" TEXT,
    "backgroundColor" TEXT NOT NULL DEFAULT '#ffffff',
    "backgroundOpacity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "borderRadius" INTEGER NOT NULL DEFAULT 0,
    "borderWidth" INTEGER NOT NULL DEFAULT 0,
    "borderColor" TEXT,
    "paddingTop" INTEGER NOT NULL DEFAULT 8,
    "paddingRight" INTEGER NOT NULL DEFAULT 12,
    "paddingBottom" INTEGER NOT NULL DEFAULT 8,
    "paddingLeft" INTEGER NOT NULL DEFAULT 12,
    "lineHeight" DOUBLE PRECISION NOT NULL DEFAULT 1.2,
    "letterSpacing" INTEGER NOT NULL DEFAULT 0,
    "wordSpacing" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "remix_text_styles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "remix_text_styles_remixId_idx" ON "public"."remix_text_styles"("remixId");

-- CreateIndex
CREATE INDEX "remix_text_styles_remixId_isDefault_idx" ON "public"."remix_text_styles"("remixId", "isDefault");

-- AddForeignKey
ALTER TABLE "public"."remix_text_styles" ADD CONSTRAINT "remix_text_styles_remixId_fkey" FOREIGN KEY ("remixId") REFERENCES "public"."remix_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
