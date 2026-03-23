import { cn } from "../lib/utils";

interface OpenCodeLogoIconProps {
  className?: string;
}

export function OpenCodeLogoIcon({ className }: OpenCodeLogoIconProps) {
  return (
    <>
      <img
        src="/brands/opencode-logo-light-square.svg"
        alt="IApex"
        className={cn("dark:hidden", className)}
      />
      <img
        src="/brands/iapex-logo-dark.svg"
        alt="IApex"
        className={cn("hidden dark:block", className)}
      />
    </>
  );
}
