import { Phone } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";

export function FloatingCTAs({ phone, whatsapp }: { phone?: string; whatsapp?: string }) {
  return (
    <>
      <a
        href={`tel:${phone?.replace(/\s/g, "")}`}
        className="fixed bottom-[100px] right-6 z-[60] bg-sky-brand hover:bg-sky-brand-hover text-white w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-colors"
        title="Call Now"
      >
        <Phone className="w-6 h-6 text-white" strokeWidth={2.25} />
      </a>
      <a
        href={`https://wa.me/${whatsapp}`}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-[60] bg-[#25D366] text-white w-[60px] h-[60px] rounded-full flex items-center justify-center shadow-xl animate-float"
        title="WhatsApp"
      >
        <WhatsAppIcon className="w-8 h-8" />
      </a>
    </>
  );
}
