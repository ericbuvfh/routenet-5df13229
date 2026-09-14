import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { QRCodeCanvas } from "qrcode.react";
import {
  X,
  Copy,
  Check,
  Share2,
  Link2,
  MessageCircle,
  Twitter,
  Facebook,
  Mail,
  QrCode,
  Download,
} from "lucide-react";

interface ShareSheetProps {
  isOpen: boolean;
  onClose: () => void;
  item: {
    type: "track" | "album" | "playlist" | "artist";
    title: string;
    subtitle?: string;
    image?: string;
    id: string;
    /** Optional explicit in-app path, e.g. /user-playlist/abc */
    path?: string;
  } | null;
}

const shareOptions = [
  { id: "qr", name: "QR Code", icon: QrCode, color: "bg-primary" },
  { id: "copy", name: "Copy Link", icon: Link2, color: "bg-muted" },
  { id: "message", name: "Message", icon: MessageCircle, color: "bg-muted" },
  { id: "twitter", name: "Twitter", icon: Twitter, color: "bg-muted" },
  { id: "facebook", name: "Facebook", icon: Facebook, color: "bg-muted" },
  { id: "email", name: "Email", icon: Mail, color: "bg-muted" },
];

export function ShareSheet({ isOpen, onClose, item }: ShareSheetProps) {
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);

  if (!item) return null;

  const origin = typeof window !== "undefined" ? window.location.origin : "https://routenet.lovable.app";
  const shareUrl = `${origin}${item.path || `/${item.type}/${item.id}`}`;

  const downloadQR = () => {
    const canvas = document.getElementById("routenet-share-qr") as HTMLCanvasElement | null;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `${item.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-qr.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const handleShare = async (optionId: string) => {
    if (optionId === "copy") {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      return;
    }

    if (optionId === "qr") {
      setShowQR(true);
      return;
    }

    const shareText = `Check out "${item.title}" on Routenet!`;

    if (navigator.share && (optionId === "message" || optionId === "native")) {
      try {
        await navigator.share({ title: item.title, text: shareText, url: shareUrl });
      } catch {
        /* share cancelled */
      }
      return;
    }

    const shareUrls: Record<string, string> = {
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
      email: `mailto:?subject=${encodeURIComponent(item.title)}&body=${encodeURIComponent(shareText + "\n\n" + shareUrl)}`,
    };

    if (shareUrls[optionId]) window.open(shareUrls[optionId], "_blank", "width=600,height=400");
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="fixed bottom-0 left-0 right-0 z-50 max-h-[90vh] overflow-y-auto rounded-t-3xl bg-background p-6 pb-10"
          >
            <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-muted" />

            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-primary/20 p-3">
                  <Share2 className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground">Share</h2>
                  <p className="text-sm text-muted-foreground">Share this {item.type}</p>
                </div>
              </div>
              <button onClick={onClose} className="rounded-full p-2 text-muted-foreground hover:bg-white/10">
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="mb-6 flex items-center gap-4 rounded-xl bg-white/5 p-4">
              {item.image && <img src={item.image} alt={item.title} className="h-14 w-14 rounded-lg object-cover" />}
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-foreground">{item.title}</p>
                {item.subtitle && <p className="truncate text-sm text-muted-foreground">{item.subtitle}</p>}
              </div>
            </div>

            {showQR ? (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center py-4">
                <div className="mb-4 rounded-2xl bg-white p-4">
                  <QRCodeCanvas id="routenet-share-qr" value={shareUrl} size={200} level="M" includeMargin={false} />
                </div>
                <p className="text-sm text-muted-foreground">Scan to open this {item.type} in Routenet</p>
                <div className="mt-4 flex items-center gap-3">
                  <button onClick={downloadQR} className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                    <Download className="h-4 w-4" />Save QR
                  </button>
                  <button onClick={() => setShowQR(false)} className="text-sm text-muted-foreground hover:text-foreground">
                    Back
                  </button>
                </div>
              </motion.div>
            ) : (
              <div className="grid grid-cols-4 gap-4">
                {shareOptions.map((option) => (
                  <button key={option.id} onClick={() => handleShare(option.id)} className="flex flex-col items-center gap-2">
                    <div className={`flex h-14 w-14 items-center justify-center rounded-full ${option.color}`}>
                      {option.id === "copy" && copied ? (
                        <Check className="h-6 w-6 text-foreground" />
                      ) : (
                        <option.icon className={`h-6 w-6 ${option.id === "qr" ? "text-primary-foreground" : "text-foreground"}`} />
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{option.id === "copy" && copied ? "Copied!" : option.name}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="mt-6 flex items-center gap-2 rounded-xl bg-white/5 p-3">
              <input type="text" value={shareUrl} readOnly className="flex-1 bg-transparent text-sm text-muted-foreground outline-none" />
              <button onClick={() => handleShare("copy")} className="flex items-center gap-1 rounded-lg bg-primary/20 px-3 py-1.5 text-sm font-medium text-primary">
                <Copy className="h-3.5 w-3.5" />{copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
