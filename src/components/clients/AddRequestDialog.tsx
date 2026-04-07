import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DeviceSpecForm, type DeviceSpecValues } from '@/components/shared/DeviceSpecForm';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  clientId: string;
}

export function AddRequestDialog({ open, onOpenChange, onSuccess, clientId }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [countries, setCountries] = useState<{ id: string; name: string }[]>([]);

  const [countryId, setCountryId] = useState('');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');

  const [deviceSpec, setDeviceSpec] = useState<DeviceSpecValues>({
    brand: '', device_model: '', processor: '', display_size: '',
    ram: '', storage: '', gpu: '', os: '', quantity: 1, addons: [], notes: '',
  });

  useEffect(() => {
    if (!open) return;
    supabase.from('countries').select('id, name').order('name').then(({ data }) => {
      if (data) setCountries(data);
    });
  }, [open]);

  useEffect(() => {
    if (open) {
      setCountryId(''); setExpectedDeliveryDate('');
      setDeviceSpec({
        brand: '', device_model: '', processor: '', display_size: '',
        ram: '', storage: '', gpu: '', os: '', quantity: 1, addons: [], notes: '',
      });
    }
  }, [open]);

  const handleSave = async () => {
    if (!deviceSpec.brand || !deviceSpec.device_model || !deviceSpec.processor ||
        !deviceSpec.display_size || !deviceSpec.ram || !deviceSpec.storage) {
      toast({ title: 'Missing fields', description: 'Please fill all required device details.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const payload = {
      client_id: clientId,
      country_id: countryId || null,
      expected_delivery_date: expectedDeliveryDate || null,
      brand: deviceSpec.brand,
      device_model: deviceSpec.device_model,
      quantity: deviceSpec.quantity,
      processor: deviceSpec.processor,
      display_size: deviceSpec.display_size,
      ram: deviceSpec.ram,
      storage: deviceSpec.storage,
      gpu: deviceSpec.gpu || null,
      os: deviceSpec.os || null,
      addons: deviceSpec.addons as any,
      notes: deviceSpec.notes || null,
      created_by: user?.id,
    };

    const { error } = await supabase.from('client_requests' as any).insert(payload);
    setSaving(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Request added', description: `${deviceSpec.brand} ${deviceSpec.device_model} request created.` });
      onOpenChange(false);
      onSuccess();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Device Request</DialogTitle>
          <DialogDescription>Create a new laptop fulfillment request for this client.</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Delivery section */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
              <h4 className="font-semibold text-sm">Delivery</h4>
              <span className="text-xs text-muted-foreground">Where and when to ship</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Select Country <span className="text-destructive">*</span></Label>
                <Select value={countryId} onValueChange={setCountryId}>
                  <SelectTrigger className="h-10"><SelectValue placeholder="Select a country" /></SelectTrigger>
                  <SelectContent>
                    {countries.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Expected Delivery Date</Label>
                <Input type="date" value={expectedDeliveryDate} onChange={(e) => setExpectedDeliveryDate(e.target.value)} className="h-10" />
              </div>
            </div>
          </div>

          <DeviceSpecForm values={deviceSpec} onChange={setDeviceSpec} sectionNumberStart={2} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
