import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { DollarSign, Package } from 'lucide-react';
import { WarehousePricingTab } from '@/components/vendors/WarehousePricingTab';
import { WarehouseStorageTab } from '@/components/vendors/WarehouseStorageTab';

const SECTIONS = [
  { id: 'pricing', label: 'Pricing', icon: DollarSign },
  { id: 'storage', label: 'Storage', icon: Package },
] as const;

export function WarehouseTab() {
  const [section, setSection] = useState<string>('pricing');

  return (
    <div className="space-y-4">
      <Tabs value={section} onValueChange={setSection}>
        <TabsList className="h-10 w-full sm:w-auto bg-muted/40 p-1 rounded-lg">
          {SECTIONS.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="gap-2 px-4 py-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md text-sm font-medium"
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="pricing" className="mt-4">
          <WarehousePricingTab />
        </TabsContent>

        <TabsContent value="storage" className="mt-4">
          <WarehouseStorageTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
