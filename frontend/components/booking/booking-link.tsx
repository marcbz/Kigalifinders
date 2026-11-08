import Link from "next/link";
import { forwardRef } from "react";
import { isInternalBookingUrl, resolveBookingUrl } from "@/lib/booking";

type BookingLinkProps = {
  href?: string | null;
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
  "aria-label"?: string;
};

/** Same-tab Link for /book; external URLs still open in a new tab. */
export const BookingLink = forwardRef<HTMLAnchorElement, BookingLinkProps>(
  function BookingLink({ href, className, children, onClick, ...rest }, ref) {
    const resolved = resolveBookingUrl(href);

    if (isInternalBookingUrl(resolved)) {
      return (
        <Link ref={ref} href={resolved} className={className} onClick={onClick} {...rest}>
          {children}
        </Link>
      );
    }

    return (
      <a
        ref={ref}
        href={resolved}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        onClick={onClick}
        {...rest}
      >
        {children}
      </a>
    );
  },
);
