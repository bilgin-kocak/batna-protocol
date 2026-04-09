import { expect } from "chai";
import {
  NegotiationType,
  salaryTemplate,
  otcTemplate,
  maTemplate,
  getTemplate,
  parseFirstInteger,
  TEMPLATE_REGISTRY,
} from "../../agent";

describe("agent/templates", function () {
  describe("salaryTemplate", function () {
    it("declares correct id, name, and example", function () {
      expect(salaryTemplate.id).to.equal(NegotiationType.SALARY);
      expect(salaryTemplate.name).to.equal("Salary");
      expect(salaryTemplate.example).to.have.property("role");
      expect(salaryTemplate.example).to.have.property("context");
    });

    it("buildPrompt embeds the context and currency", function () {
      const prompt = salaryTemplate.buildPrompt({
        role: "partyA",
        context: "Senior engineer at a Series B in NYC, 7 years experience",
        currency: "USD",
      });
      expect(prompt).to.include("Senior engineer at a Series B in NYC, 7 years experience");
      expect(prompt).to.include("USD");
      expect(prompt).to.match(/CANDIDATE/);
    });

    it("buildPrompt switches CANDIDATE/EMPLOYER framing by role", function () {
      const candidatePrompt = salaryTemplate.buildPrompt({
        role: "partyA",
        context: "x",
      });
      const employerPrompt = salaryTemplate.buildPrompt({
        role: "partyB",
        context: "x",
      });
      expect(candidatePrompt).to.match(/CANDIDATE/);
      expect(candidatePrompt).to.not.match(/EMPLOYER/);
      expect(employerPrompt).to.match(/EMPLOYER/);
      expect(employerPrompt).to.not.match(/CANDIDATE/);
    });

    it("parseResponse extracts integer from clean number", function () {
      expect(salaryTemplate.parseResponse("142000")).to.equal(142000n);
    });

    it("parseResponse tolerates currency symbols and commas", function () {
      expect(salaryTemplate.parseResponse("$142,000")).to.equal(142000n);
    });

    it("parseResponse tolerates trailing prose (extracts first number)", function () {
      expect(
        salaryTemplate.parseResponse("My recommendation is 137500 USD per year.")
      ).to.equal(137500n);
    });
  });

  describe("otcTemplate", function () {
    it("declares correct id and OTC framing", function () {
      expect(otcTemplate.id).to.equal(NegotiationType.OTC);
      expect(otcTemplate.name).to.equal("OTC");
    });

    it("buildPrompt distinguishes SELLER and BUYER", function () {
      const seller = otcTemplate.buildPrompt({ role: "partyA", context: "x" });
      const buyer = otcTemplate.buildPrompt({ role: "partyB", context: "x" });
      expect(seller).to.match(/SELLER/);
      expect(buyer).to.match(/BUYER/);
    });

    it("buildPrompt instructs cents quoting (euint64-safe)", function () {
      const prompt = otcTemplate.buildPrompt({ role: "partyA", context: "x" });
      expect(prompt).to.match(/CENTS/i);
    });
  });

  describe("maTemplate", function () {
    it("declares correct id and M&A framing", function () {
      expect(maTemplate.id).to.equal(NegotiationType.MA);
      expect(maTemplate.name).to.equal("M&A");
    });

    it("buildPrompt distinguishes seller board and acquirer", function () {
      const seller = maTemplate.buildPrompt({ role: "partyA", context: "x" });
      const buyer = maTemplate.buildPrompt({ role: "partyB", context: "x" });
      expect(seller).to.match(/SELLER'S BOARD/);
      expect(buyer).to.match(/ACQUIRER/);
    });

    it("buildPrompt instructs millions quoting (euint64-safe)", function () {
      const prompt = maTemplate.buildPrompt({ role: "partyA", context: "x" });
      expect(prompt).to.match(/MILLIONS/);
    });
  });

  describe("registry", function () {
    it("getTemplate returns the right template by enum", function () {
      expect(getTemplate(NegotiationType.SALARY)).to.equal(salaryTemplate);
      expect(getTemplate(NegotiationType.OTC)).to.equal(otcTemplate);
      expect(getTemplate(NegotiationType.MA)).to.equal(maTemplate);
    });

    it("getTemplate throws for GENERIC (no template)", function () {
      expect(() => getTemplate(NegotiationType.GENERIC)).to.throw(
        /No template registered/
      );
    });

    it("registry covers all non-GENERIC enum values", function () {
      // Three valid templates registered
      const registered = Object.entries(TEMPLATE_REGISTRY).filter(([, v]) => v !== undefined);
      expect(registered.length).to.equal(3);
    });
  });

  describe("parseFirstInteger", function () {
    it("returns bigint for plain digits", function () {
      expect(parseFirstInteger("12345")).to.equal(12345n);
    });

    it("strips $ and commas", function () {
      expect(parseFirstInteger("$1,250,000")).to.equal(1250000n);
    });

    it("strips €, £, ¥, ₹", function () {
      expect(parseFirstInteger("€500")).to.equal(500n);
      expect(parseFirstInteger("£500")).to.equal(500n);
      expect(parseFirstInteger("¥500")).to.equal(500n);
      expect(parseFirstInteger("₹500")).to.equal(500n);
    });

    it("truncates decimals (takes integer part)", function () {
      expect(parseFirstInteger("142.99")).to.equal(142n);
    });

    it("throws on empty input", function () {
      expect(() => parseFirstInteger("")).to.throw();
    });

    it("throws when no digits at all", function () {
      expect(() => parseFirstInteger("no number here")).to.throw();
    });
  });
});
