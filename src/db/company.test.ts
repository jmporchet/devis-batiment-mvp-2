import { beforeEach, describe, expect, it } from "vitest";
import { DEMO_COMPANY } from "@/domain/types";
import { getCompany, getCompanyLogo, MAX_LOGO_BYTES, setCompanyLogo, updateCompany } from "./company";
import { createDb, type Db } from "./create-db";

let db: Db;
beforeEach(() => {
  db = createDb(":memory:");
});

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32)]);

describe("getCompany", () => {
  it("crée les coordonnées de démonstration au premier accès", () => {
    expect(getCompany(db)).toMatchObject({ ...DEMO_COMPANY, hasLogo: false });
    expect(getCompanyLogo(db)).toBeNull();
  });
});

describe("updateCompany", () => {
  it("enregistre les champs modifiés et nettoie les espaces", () => {
    const c = updateCompany(db, { name: "  Dupont Carrelage SA ", validityDays: 60, website: "" });
    expect(c).toMatchObject({ name: "Dupont Carrelage SA", validityDays: 60, street: DEMO_COMPANY.street });
  });

  it("refuse les valeurs invalides avec un message par champ", () => {
    expect(() => updateCompany(db, { name: " " })).toThrow(/raison sociale est obligatoire/);
    expect(() => updateCompany(db, { email: "pas-un-mail" })).toThrow(/e-mail invalide/);
    expect(() => updateCompany(db, { validityDays: 0 })).toThrow(/au moins 1 jour/);
    expect(() => updateCompany(db, { validityDays: 2.5 })).toThrow(/entier/);
    try {
      updateCompany(db, { email: "x" });
    } catch (e) {
      expect((e as { fieldErrors: Record<string, string> }).fieldErrors).toHaveProperty("email");
    }
    expect(getCompany(db).name).toBe(DEMO_COMPANY.name);
  });
});

describe("setCompanyLogo", () => {
  it("accepte PNG et JPEG, détecte le type et permet de retirer le logo", () => {
    expect(setCompanyLogo(db, PNG).hasLogo).toBe(true);
    expect(getCompanyLogo(db)).toEqual({ bytes: PNG, mimeType: "image/png" });
    setCompanyLogo(db, JPEG);
    expect(getCompanyLogo(db)?.mimeType).toBe("image/jpeg");
    expect(setCompanyLogo(db, null).hasLogo).toBe(false);
    expect(getCompanyLogo(db)).toBeNull();
  });

  it("refuse un SVG, un faux fichier ou un logo trop lourd", () => {
    expect(() => setCompanyLogo(db, Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"))).toThrow(/PNG ou JPEG/);
    expect(() => setCompanyLogo(db, Buffer.concat([PNG, Buffer.alloc(MAX_LOGO_BYTES)]))).toThrow(/1 Mo/);
    expect(getCompany(db).hasLogo).toBe(false);
  });
});
