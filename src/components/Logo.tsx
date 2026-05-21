import Link from "next/link";
import Image from "next/image";

interface LogoProps {
  href?: string;
  size?: "sm" | "lg";
}

export function Logo({ href = "/", size = "sm" }: LogoProps) {
  const markSize = size === "lg" ? "h-16 w-16" : "h-10 w-10";
  const titleSize = size === "lg" ? "text-4xl" : "text-xl";
  const subtitleSize = size === "lg" ? "text-sm" : "text-xs";

  const content = (
    <span className="inline-flex items-center gap-3">
      <Image src="/favicon.svg" alt="" width={64} height={64} className={`${markSize} rounded-lg`} />
      <span className="leading-none">
        <span className={`block font-semibold tracking-tight text-ink ${titleSize}`}>CampaignScan</span>
        <span className={`mt-1 block font-medium text-gray-500 ${subtitleSize}`}>by Adsvantage</span>
      </span>
    </span>
  );

  return (
    <Link href={href} className="inline-flex rounded-md focus:outline-none focus:ring-2 focus:ring-ink focus:ring-offset-2">
      {content}
    </Link>
  );
}
