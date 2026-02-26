// shared/UsernameLink.jsx
import { Link } from "react-router-dom";
import { userProfilePath } from "../utils/paths";

export default function UsernameLink({
  user,                  // { id, username }
  username,              // optional if you only have username
  id,                    // optional if you only have id
  withAt = true,
  className = "",
  stopPropagation = true,
  to,                    // override path if needed
  children,              // optional custom content instead of the default handle
  title,
}) {
  const u = user || { id, username };
  const label = u?.username ? `${withAt ? "@" : ""}${u.username}` : `${withAt ? "@" : ""}private_seller`;
  const path = to ?? userProfilePath(u);

  // No username => show blurred/private label, not clickable
  if (!u?.username || !path) {
    return (
      <span
        className={[
          "truncate text-sm text-muted-foreground",
          !u?.username ? "select-none blur-[3px]" : "",
          className,
        ].join(" ")}
        title={title || label}
      >
        {label}
      </span>
    );
  }

  const stop = (e) => e.stopPropagation();

  return (
    <Link
      to={path}
      onClick={stopPropagation ? stop : undefined}
      onKeyDown={stopPropagation ? stop : undefined}
      className={[
        "truncate text-sm text-muted-foreground hover:underline focus:underline focus:outline-none",
        className,
      ].join(" ")}
      title={title || label}
      aria-label={`View profile of ${label}`}
    >
      {children ?? label}
    </Link>
  );
}