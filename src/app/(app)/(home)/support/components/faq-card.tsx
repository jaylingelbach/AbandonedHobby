import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Search,
  Truck,
  MessageSquare,
  RefreshCw,
  Flag,
  Lock,
  CheckCircle2,
  DollarSign,
  Wallet,
  HelpCircle,
  Bell
} from 'lucide-react';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent
} from '@/components/ui/accordion';
type QA = { q: string; a: React.ReactNode };

export default function FaqCard({
  title,
  faqs,
  hue = 'yellow'
}: {
  title: string;
  faqs: QA[];
  hue?: 'yellow' | 'cyan';
}) {
  const chip = hue === 'yellow' ? 'bg-yellow-200' : 'bg-cyan-200';
  return (
    <Card className="rounded-3xl border-4 border-black bg-white shadow-[10px_10px_0_#000]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl font-black">
          <HelpCircle className="h-5 w-5" aria-hidden /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((f, i) => (
            <AccordionItem
              key={i}
              value={`item-${i}`}
              className="rounded-xl border-4 border-black px-3 py-2 shadow-[6px_6px_0_#000] not-first:mt-3"
            >
              <AccordionTrigger className="text-left">
                <span
                  className={`mr-2 rounded-md border-2 border-black ${chip} px-1 text-[10px] font-black`}
                >
                  FAQ
                </span>
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}
