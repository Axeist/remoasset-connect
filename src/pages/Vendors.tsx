import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Globe2, Laptop, Warehouse } from 'lucide-react';
import { VendorDirectory } from '@/components/vendors/VendorDirectory';
import { DevicePricingTab } from '@/components/vendors/DevicePricingTab';
import { WarehouseTab } from '@/components/vendors/WarehouseTab';

const TABS = [
  { id: 'directory', label: 'Vendor Directory', icon: Globe2 },
  { id: 'device-pricing', label: 'Device Pricing', icon: Laptop },
  { id: 'warehouse', label: 'Warehouse', icon: Warehouse },
] as const;

type TabId = (typeof TABS)[number]['id'];

const LEGACY_TAB_ALIASES: Record<string, TabId> = {
  'warehouse-pricing': 'warehouse',
};

export default function Vendors() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab') ?? 'directory';
  const resolvedTab = (LEGACY_TAB_ALIASES[rawTab] ?? rawTab) as TabId;
  const initialTab = TABS.some((t) => t.id === resolvedTab) ? resolvedTab : 'directory';
  const [activeTab, setActiveTab] = useState<string>(initialTab);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setSearchParams(value === 'directory' ? {} : { tab: value }, { replace: true });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground tracking-tight">Vendors</h1>
            <p className="text-muted-foreground mt-1">
              Onboarded vendors, device pricing & warehouse services — all in one place
            </p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="h-11 w-full sm:w-auto bg-muted/60 p-1 rounded-lg">
            {TABS.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="gap-2 px-4 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md text-sm font-medium transition-all"
              >
                <tab.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="directory" className="mt-6">
            <VendorDirectory />
          </TabsContent>

          <TabsContent value="device-pricing" className="mt-6">
            <DevicePricingTab />
          </TabsContent>

          <TabsContent value="warehouse" className="mt-6">
            <WarehouseTab />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
