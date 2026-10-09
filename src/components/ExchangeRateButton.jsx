import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/components/ui/use-toast';
import { ArrowLeftRight } from 'lucide-react';

// Edits the SAR exchange rate saved on a price list (master file) that is not in SAR.
export default function ExchangeRateButton({ masterFile, rate, onSaved }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const currency = masterFile?.currency;

  useEffect(() => { if (open) setValue(rate ? String(rate) : ''); }, [open, rate]);

  if (!masterFile || !currency || currency === 'SAR') return null;

  const handleSave = async () => {
    const n = Number(value);
    if (!(n > 0)) {
      toast({ title: 'Enter a rate above zero', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await base44.entities.MasterFile.update(masterFile.id, { sar_rate: n });
      onSaved?.(n);
      setOpen(false);
      toast({ title: 'Exchange rate saved', description: `1 ${currency} = ${n} SAR` });
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Could not save the exchange rate.', variant: 'destructive' });
    }
    setSaving(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline">
          <ArrowLeftRight className="w-4 h-4 mr-1" />
          {rate ? `1 ${currency} = ${rate} SAR` : 'Set SAR rate'}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3">
        <div>
          <p className="text-sm font-semibold">Exchange rate to SAR</p>
          <p className="text-xs text-muted-foreground">Used to show SAR next to prices and in totals. Prices stay in {currency}.</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="shrink-0">1 {currency} =</span>
          <Input type="number" step="0.0001" min="0" className="h-9" value={value} onChange={e => setValue(e.target.value)} />
          <span className="shrink-0">SAR</span>
        </div>
        <Button size="sm" className="w-full" onClick={handleSave} disabled={saving}>Save</Button>
      </PopoverContent>
    </Popover>
  );
}
