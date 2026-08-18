import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const CROPPER = readFileSync(join(process.cwd(), "src/components/settings/image-cropper.tsx"), "utf8");
const LOGO = readFileSync(join(process.cwd(), "src/components/shared/business-logo.tsx"), "utf8");
const AVATAR = readFileSync(join(process.cwd(), "src/components/ui/avatar.tsx"), "utf8");
const SETTINGS = readFileSync(join(process.cwd(), "src/components/settings/profile-settings.tsx"), "utf8");

/**
 * Logos and avatars are cropped and resized client-side before upload.
 *
 * The two behave DIFFERENTLY on purpose: an avatar fills its circle (cropping
 * the overflow), while a logo fits whole inside its box. Cropping a logo would
 * cut off part of the brand, and a wide banner logo is the case that exposes it.
 */
describe("a logo fits whole, whatever its shape", () => {
  it("uses contain for logos and cover for avatars", () => {
    expect(SETTINGS).toMatch(/fit=\{pending\.kind === "avatar" \? "cover" : "contain"\}/);
  });

  it("contain scales by the SMALLER ratio, so nothing is cut off", () => {
    expect(CROPPER).toMatch(/Math\.min\(frameW \/ img\.width, frameH \/ img\.height\)/);
  });

  it("cover scales by the larger ratio, so the circle is filled", () => {
    expect(CROPPER).toMatch(/Math\.max\(frameW \/ img\.width, frameH \/ img\.height\)/);
  });

  it("fills the background white before drawing", () => {
    // JPEG has no alpha; a transparent PNG logo would otherwise export black.
    expect(CROPPER).toMatch(/ctx\.fillStyle = "#ffffff"/);
    expect(CROPPER).toMatch(/ctx\.fillRect\(0, 0, outW, outH\)/);
  });

  it("displays a logo with object-contain, so a wide one is not cropped again", () => {
    expect(LOGO).toMatch(/object-contain/);
  });

  it("displays an avatar with object-cover, so a non-square one cannot stretch", () => {
    // The cropper always exports square, but an image arriving by any other
    // route would distort without this.
    expect(AVATAR).toMatch(/aspect-square h-full w-full object-cover/);
  });
});

describe("the export is a fixed size", () => {
  it("is 512px wide, with height following the aspect", () => {
    expect(SETTINGS).toMatch(/outputWidth=\{512\}/);
    expect(CROPPER).toMatch(/const outH = Math\.round\(outputWidth \/ aspect\)/);
  });

  it("cannot be zoomed below the fitting scale", () => {
    // baseScale is the floor, so a logo can never be shrunk to a speck inside
    // an otherwise empty frame.
    expect(CROPPER).toMatch(/const scale = baseScale \* zoom/);
  });
});
