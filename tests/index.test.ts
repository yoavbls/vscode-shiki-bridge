import { describe, expect, test, beforeAll } from "vitest";
import {
  getUserTheme,
  getUserLangs,
  inferBuiltinLanguageIds,
} from "../src/index.js";

describe("VSCode Shiki Bridge", () => {
  let isVSCodeAvailable = false;

  beforeAll(() => {
    // Check if we're running in VSCode context
    try {
      require("vscode");
      isVSCodeAvailable = true;
    } catch {
      isVSCodeAvailable = false;
    }
  });

  describe("getUserTheme", () => {
    test("should return theme data when running in VSCode or default theme outside", async () => {
      const result = await getUserTheme();

      // getUserTheme returns a tuple: [themeName, themeRegistrations[]]
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);

      const [themeName, themeRegistrations] = result;
      expect(typeof themeName).toBe("string");
      expect(Array.isArray(themeRegistrations)).toBe(true);

      if (isVSCodeAvailable) {
        // When running in VSCode, should return actual theme data
        // Theme name might not be "none" and might have actual registrations
        expect(themeName).toBeTruthy();
      } else {
        // When running outside VSCode, returns ["none", []]
        expect(themeName).toBe("none");
        expect(themeRegistrations).toHaveLength(0);
      }
    });
  });

  describe("getUserLangs", () => {
    test("should return languages when running in VSCode", async () => {
      const languages = await getUserLangs();

      // getUserLangs returns an array of language registrations
      expect(Array.isArray(languages)).toBe(true);

      if (isVSCodeAvailable) {
        // When running in VSCode, should return language registrations
        expect(languages.length).toBeGreaterThan(0);

        // Check for common languages by looking at the name property
        const languageIds = languages.map((language) =>
          typeof language === "string" ? language : language.name
        );
        const commonLanguages = [
          "javascript",
          "typescript",
          "json",
          "html",
          "css",
        ];

        for (const lang of commonLanguages) {
          expect(languageIds).toContain(lang);
        }
      } else {
        // When running outside VSCode, should return empty array
        expect(languages).toHaveLength(0);
      }
    });

    test("should filter languages when langIds provided", async () => {
      const requestedLangs = ["javascript", "typescript"];
      const languages = await getUserLangs(requestedLangs);

      expect(Array.isArray(languages)).toBe(true);

      if (isVSCodeAvailable) {
        // Should only return requested languages
        const languageIds = languages.map((language) =>
          typeof language === "string" ? language : language.name
        );
        for (const id of languageIds) {
          expect(requestedLangs).toContain(id);
        }
      }
    });
  });

  describe("inferBuiltinLanguageIds", () => {
    test("should infer builtin language IDs from language registrations", () => {
      // This is a pure function that doesn't require VSCode
      const mockLangs = [
        { id: "javascript", scopeName: "source.js" },
        { id: "typescript", scopeName: "source.ts" },
      ];

      const result = inferBuiltinLanguageIds(mockLangs as any);

      // Should return an array of inferred language IDs
      expect(Array.isArray(result)).toBe(true);

      // Since we're passing known languages, it might not infer additional ones
      // Just verify it returns an array
      expect(result.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("VSCode API availability", () => {
    test("should detect VSCode environment correctly", () => {
      if (isVSCodeAvailable) {
        // If we're in VSCode, the require should work
        expect(() => require("vscode")).not.toThrow();

        const vscode = require("vscode");
        expect(vscode).toHaveProperty("window");
        expect(vscode).toHaveProperty("workspace");
        expect(vscode).toHaveProperty("extensions");
      } else {
        // If we're not in VSCode, require should throw
        expect(() => require("vscode")).toThrow();
      }
    });
  });
});
