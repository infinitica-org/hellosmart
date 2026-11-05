'use client';

import React, { useState, useEffect } from 'react';
import {
  PageHeader,
  Card,
  TextField,
  SelectField,
  Button,
  Badge,
  Alert,
} from '@hs/ui';
import { Calculator, ArrowRight, ShieldCheck } from 'lucide-react';
import { useCalculateGstMutation } from '@/store/admin/adminApi';

const INDIAN_STATES = [
  { code: 'KA', name: 'Karnataka (Intra-state CGST+SGST)' },
  { code: 'MH', name: 'Maharashtra (Inter-state IGST)' },
  { code: 'DL', name: 'Delhi (Inter-state IGST)' },
  { code: 'TN', name: 'Tamil Nadu (Inter-state IGST)' },
  { code: 'TG', name: 'Telangana (Inter-state IGST)' },
  { code: 'UP', name: 'Uttar Pradesh (Inter-state IGST)' },
  { code: 'WB', name: 'West Bengal (Inter-state IGST)' },
  { code: 'GJ', name: 'Gujarat (Inter-state IGST)' },
  { code: 'HR', name: 'Haryana (Inter-state IGST)' },
  { code: 'KL', name: 'Kerala (Inter-state IGST)' },
];

export default function GstCalculatorPage() {
  const [subtotal, setSubtotal] = useState('50000');
  const [discount, setDiscount] = useState('5000');
  const [customerCountry, setCustomerCountry] = useState('IN');
  const [customerState, setCustomerState] = useState('KA');

  const [calculateGst, { data: result, isLoading, error }] = useCalculateGstMutation();

  const handleCalculate = async () => {
    const sub = parseFloat(subtotal) || 0;
    const disc = parseFloat(discount) || 0;

    try {
      await calculateGst({
        currency: 'INR',
        customerJurisdiction: {
          country: customerCountry,
          state: customerCountry === 'IN' ? customerState : undefined,
        },
        lines: [
          {
            lineSubtotal: sub,
            discountAmount: disc,
          },
        ],
      }).unwrap();
    } catch (err) {
      console.error('GST calculation error', err);
    }
  };

  useEffect(() => {
    void handleCalculate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal, discount, customerCountry, customerState]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="18% Domestic GST Engine Calculator"
        description="Statutory Goods and Services Tax (GST) engine enforcing dual-snapshot immutability, rounded paise math, and fail-closed international classification."
        badge={{ text: 'GST Engine', variant: 'info' }}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Input Parameters Form */}
        <Card className="lg:col-span-5 p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-neutral-100 pb-3">
            <Calculator className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-neutral-900">Tax Simulation Parameters</h2>
          </div>

          <div className="space-y-3">
            <TextField
              label="Line Subtotal (INR ₹)"
              size="sm"
              type="number"
              step="0.01"
              value={subtotal}
              onChange={(e) => setSubtotal(e.target.value)}
              required
            />

            <TextField
              label="Promo Discount (INR ₹)"
              size="sm"
              type="number"
              step="0.01"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
            />

            <SelectField
              label="Customer Country"
              value={customerCountry}
              onChange={(e) => setCustomerCountry(e.target.value)}
              options={[
                { value: 'IN', label: 'India (Domestic Supply)' },
                { value: 'US', label: 'United States (Export - Requires LUT)' },
                { value: 'GB', label: 'United Kingdom (Export - Requires LUT)' },
                { value: 'SG', label: 'Singapore (Export - Requires LUT)' },
              ]}
            />

            {customerCountry === 'IN' && (
              <SelectField
                label="Customer State / UT"
                value={customerState}
                onChange={(e) => setCustomerState(e.target.value)}
                options={INDIAN_STATES.map((st) => ({
                  value: st.code,
                  label: st.name,
                }))}
              />
            )}

            <Button
              variant="primary"
              size="sm"
              className="w-full mt-2"
              onClick={handleCalculate}
              isLoading={isLoading}
            >
              Re-calculate Tax
            </Button>
          </div>
        </Card>

        {/* Real-time Calculation Breakdown Output */}
        <Card className="lg:col-span-7 p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
            <h2 className="text-sm font-semibold text-neutral-900">Tax Breakdown Output</h2>
            {result?.taxClassification && (
              <Badge
                variant={result.taxClassification === 'intra_state' ? 'info' : 'primary'}
                className="uppercase font-mono text-[11px]"
              >
                {result.taxClassification.replace('_', ' ')}
              </Badge>
            )}
          </div>

          {error ? (
            <Alert variant="error" className="text-xs">
              {(error as any)?.data?.detail || 'Failed to calculate GST. International quotes require authorized LUT.'}
            </Alert>
          ) : result ? (
            <div className="space-y-4">
              <div className="bg-neutral-50 rounded-xl p-4 space-y-2.5 text-xs">
                <div className="flex justify-between items-center text-neutral-600">
                  <span>Gross Subtotal:</span>
                  <span className="font-mono font-medium text-neutral-800">
                    INR {parseFloat(subtotal || '0').toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex justify-between items-center text-neutral-600">
                  <span>Discount Applied:</span>
                  <span className="font-mono font-medium text-emerald-600">
                    - INR {parseFloat(discount || '0').toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="border-t border-neutral-200 pt-2 flex justify-between items-center font-semibold text-neutral-900">
                  <span>Taxable Base Value:</span>
                  <span className="font-mono">
                    INR {result.lines?.[0]?.taxableAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Tax Splits */}
              <div className="border border-neutral-200 rounded-xl p-4 space-y-2 text-xs">
                <div className="font-semibold text-neutral-900 text-xs mb-2">Statutory 18% GST Components</div>

                {result.taxClassification === 'intra_state' ? (
                  <>
                    <div className="flex justify-between items-center text-neutral-600">
                      <span>Central GST (CGST 9%):</span>
                      <span className="font-mono font-medium text-neutral-900">
                        INR {result.cgstTotal?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-neutral-600">
                      <span>State GST (SGST 9%):</span>
                      <span className="font-mono font-medium text-neutral-900">
                        INR {result.sgstTotal?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between items-center text-neutral-600">
                    <span>Integrated GST (IGST 18%):</span>
                    <span className="font-mono font-medium text-neutral-900">
                      INR {result.igstTotal?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}

                <div className="border-t border-neutral-200 pt-2 flex justify-between items-center font-semibold text-neutral-900">
                  <span>Total Statutory Tax:</span>
                  <span className="font-mono text-primary">
                    INR {result.taxTotal?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Final Payable Amount */}
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <div className="text-xs text-neutral-600">Final Quotation Payable Amount</div>
                  <div className="text-[11px] text-neutral-400">Reconciled with paise math rounding</div>
                </div>
                <div className="font-mono text-xl font-bold text-primary">
                  INR {((result.lines?.[0]?.taxableAmount || 0) + (result.taxTotal || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-neutral-400">Enter parameters to simulate tax breakdown.</div>
          )}
        </Card>
      </div>
    </div>
  );
}

