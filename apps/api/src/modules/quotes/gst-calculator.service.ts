import { Inject, Injectable, Optional } from '@nestjs/common';
import type {
  Currency,
  TaxClassification,
  TaxJurisdiction,
  TaxType,
} from '@hs/contracts';
import { APP_CONFIG } from '../../config/config.tokens.js';
import type { Config } from '../../config/config.js';
import { problem } from '../../common/errors/app-http.exception.js';

export interface LineTaxInput {
  lineSubtotal: number;
  discountAmount: number;
}

export interface LineTaxResult {
  taxableAmount: number;
  taxType: TaxType;
  taxRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  taxAmount: number;
  lineTotal: number;
}

export interface ExportTreatmentConfig {
  treatment?: 'reject' | 'zero_rated_lut' | 'standard_igst' | undefined;
  lutNumber?: string | undefined;
}

export interface QuoteTaxResult {
  taxClassification: TaxClassification;
  sellerJurisdiction: TaxJurisdiction;
  customerJurisdiction: TaxJurisdiction;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  taxTotal: number;
  lines: LineTaxResult[];
}

function roundToTwo(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

@Injectable()
export class GstCalculatorService {
  constructor(
    @Optional() @Inject(APP_CONFIG) private readonly config?: Config,
  ) {}

  /**
   * Resolves and strictly validates seller tax jurisdiction from server configuration.
   * Never silently substitutes a fallback jurisdiction.
   */
  resolveSellerJurisdiction(override?: TaxJurisdiction | undefined): TaxJurisdiction {
    const raw = override
      ? {
          country: override.country ?? this.config?.SELLER_COUNTRY,
          state: override.state ?? this.config?.SELLER_STATE,
          city: override.city ?? this.config?.SELLER_CITY,
          pinCode: override.pinCode ?? this.config?.SELLER_PIN_CODE,
          gstin: override.gstin ?? this.config?.SELLER_GSTIN,
        }
      : (this.config
        ? {
            country: this.config.SELLER_COUNTRY,
            state: this.config.SELLER_STATE,
            city: this.config.SELLER_CITY,
            pinCode: this.config.SELLER_PIN_CODE,
            ...(this.config.SELLER_GSTIN ? { gstin: this.config.SELLER_GSTIN } : {}),
          }
        : undefined);

    if (
      !raw ||
      !raw.country ||
      !raw.state
    ) {
      throw problem({
        title: 'Unprocessable Entity',
        status: 422,
        detail:
          'Seller tax jurisdiction is unconfigured or incomplete: SELLER_COUNTRY and SELLER_STATE server configuration are required to calculate GST',
        code: 'SELLER_JURISDICTION_CONFIG_MISSING',
      });
    }

    const country = raw.country.trim().toUpperCase();
    const state = raw.state.trim().toUpperCase();

    if (country.length !== 2 || state.length === 0) {
      throw problem({
        title: 'Unprocessable Entity',
        status: 422,
        detail:
          'Seller tax jurisdiction is invalid: country must be 2 characters and state cannot be empty',
        code: 'SELLER_JURISDICTION_INVALID',
      });
    }

    return {
      country,
      state: state || undefined,
      city: raw.city?.trim() || undefined,
      pinCode: raw.pinCode?.trim() || undefined,
      ...(raw.gstin ? { gstin: raw.gstin.trim() } : {}),
    };
  }

  /**
   * Evaluates server-controlled tax classification and calculates GST with 2-decimal precision.
   * Never infers jurisdiction from currency alone.
   * Rejects international transactions unless authorized export/LUT configuration is supplied.
   */
  calculateTax(params: {
    currency: Currency;
    customerJurisdiction: TaxJurisdiction;
    sellerJurisdiction?: TaxJurisdiction | undefined;
    exportConfig?: ExportTreatmentConfig | undefined;
    lines: LineTaxInput[];
  }): QuoteTaxResult {
    // 1. Resolve and validate seller jurisdiction
    const seller = this.resolveSellerJurisdiction(params.sellerJurisdiction);
    const customer = params.customerJurisdiction;

    if (!customer.country || customer.country.trim().length !== 2) {
      throw problem({
        title: 'Unprocessable Entity',
        status: 422,
        detail: 'Customer tax jurisdiction must include a valid 2-letter ISO country code',
        code: 'CUSTOMER_COUNTRY_INVALID',
      });
    }

    const sellerCountry = seller.country.toUpperCase();
    const customerCountry = customer.country.trim().toUpperCase();

    let taxClassification: TaxClassification;
    let taxType: TaxType;
    let taxRate: number;
    let isCgstSgst = false;
    let isIgst = false;

    if (customerCountry !== 'IN') {
      // 2. Server-controlled international tax evaluation
      const treatment =
        params.exportConfig?.treatment ??
        this.config?.INTERNATIONAL_TAX_TREATMENT ??
        'reject';
      const lutNumber =
        params.exportConfig?.lutNumber ?? this.config?.EXPORT_LUT_NUMBER;

      if (treatment === 'reject') {
        throw problem({
          title: 'Unprocessable Entity',
          status: 422,
          detail: `International quote creation for country '${customerCountry}' is currently disabled: authorized export/LUT tax classification is not configured`,
          code: 'INTERNATIONAL_TAX_CLASSIFICATION_REQUIRED',
        });
      }

      if (treatment === 'zero_rated_lut') {
        if (!lutNumber || lutNumber.trim().length === 0) {
          throw problem({
            title: 'Unprocessable Entity',
            status: 422,
            detail: 'Zero-rated export requires an authorized Letter of Undertaking (LUT) number',
            code: 'EXPORT_LUT_REQUIRED',
          });
        }
        taxClassification = 'export';
        taxType = 'none';
        taxRate = 0;
      } else if (treatment === 'standard_igst') {
        taxClassification = 'inter_state';
        taxType = 'igst';
        taxRate = 0.18;
        isIgst = true;
      } else {
        throw problem({
          title: 'Unprocessable Entity',
          status: 422,
          detail: `Unsupported international tax treatment '${treatment}'`,
          code: 'INTERNATIONAL_TAX_TREATMENT_INVALID',
        });
      }
    } else {
      // 3. Domestic Indian supply: requires valid state
      if (!customer.state || customer.state.trim().length === 0) {
        throw problem({
          title: 'Unprocessable Entity',
          status: 422,
          detail: 'Indian domestic supply requires a valid customer state code for GST determination',
          code: 'GST_CUSTOMER_STATE_REQUIRED',
        });
      }

      const sellerState = (seller.state || '').toUpperCase().trim();
      const customerState = (customer.state || '').toUpperCase().trim();

      if (sellerCountry === 'IN' && customerState === sellerState) {
        // Intra-state: CGST 9% + SGST 9% = 18%
        taxClassification = 'intra_state';
        taxType = 'cgst_sgst';
        taxRate = 0.18;
        isCgstSgst = true;
      } else {
        // Inter-state: IGST 18%
        taxClassification = 'inter_state';
        taxType = 'igst';
        taxRate = 0.18;
        isIgst = true;
      }
    }

    let cgstTotal = 0;
    let sgstTotal = 0;
    let igstTotal = 0;
    let taxTotal = 0;

    const calculatedLines: LineTaxResult[] = params.lines.map((line) => {
      const taxableAmount = roundToTwo(line.lineSubtotal - line.discountAmount);
      if (taxableAmount < 0) {
        throw problem({
          title: 'Unprocessable Entity',
          status: 422,
          detail: 'Line taxable amount cannot be negative after discount',
          code: 'NEGATIVE_TAXABLE_AMOUNT',
        });
      }

      let lineCgst = 0;
      let lineSgst = 0;
      let lineIgst = 0;
      let lineTaxAmount = 0;

      if (isCgstSgst) {
        lineCgst = roundToTwo(taxableAmount * 0.09);
        lineSgst = roundToTwo(taxableAmount * 0.09);
        lineTaxAmount = roundToTwo(lineCgst + lineSgst);
      } else if (isIgst) {
        lineIgst = roundToTwo(taxableAmount * 0.18);
        lineTaxAmount = lineIgst;
      }

      const lineTotal = roundToTwo(taxableAmount + lineTaxAmount);

      cgstTotal = roundToTwo(cgstTotal + lineCgst);
      sgstTotal = roundToTwo(sgstTotal + lineSgst);
      igstTotal = roundToTwo(igstTotal + lineIgst);
      taxTotal = roundToTwo(taxTotal + lineTaxAmount);

      return {
        taxableAmount,
        taxType,
        taxRate,
        cgstAmount: lineCgst,
        sgstAmount: lineSgst,
        igstAmount: lineIgst,
        taxAmount: lineTaxAmount,
        lineTotal,
      };
    });

    return {
      taxClassification,
      sellerJurisdiction: seller,
      customerJurisdiction: customer,
      cgstTotal,
      sgstTotal,
      igstTotal,
      taxTotal,
      lines: calculatedLines,
    };
  }
}
