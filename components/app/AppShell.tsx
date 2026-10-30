"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronsLeft,
  ChevronsRight,
  Files,
  LayoutDashboard,
  Library,
  LogOut,
  Menu,
  MessageSquare,
  MessageSquarePlus,
  Settings,
  Star,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Avatar } from "@/components/shared/Avatar";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown";
import { cn } from "@/lib/utils";
import { QuickCreate } from "./QuickCreate";
import { SearchBox } from "./SearchBox";

export interface ShellUser {
  name: string;
  email: string;
  avatarUrl: string | null;
}
export interface ShellConversation {
  id: string;
  title: string;
}

const NAV: { href: string; label: string; icon: LucideIcon; exact?: boolean }[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/knowledge-bases", label: "My Knowledge Bases", icon: Library },
  { href: "/documents", label: "All Documents", icon: Files },
  { href: "/chat", label: "New Chat", icon: MessageSquarePlus, exact: true },
  { href: "/starred", label: "Starred", icon: Star },
  { href: "/settings", label: "Settings", icon: Settings },
];

const COLLAPSE_KEY = "documind-sidebar-collapsed";

export function AppShell({
  user,
  conversations,
  children,
}: {
  user: ShellUser;
  conversations: ShellConversation[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const signOutForm = useRef<HTMLFormElement>(null);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);
  function toggleCollapsed() {
    setCollapsed((value) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, value ? "0" : "1");
      } catch {
        /* ignore */
      }
      return !value;
    });
  }

  // Close the mobile drawer after navigating.
  useEffect(() => setDrawerOpen(false), [pathname]);

  const sidebar = (isCollapsed: boolean) => (
    <SidebarContent
      user={user}
      conversations={conversations}
      collapsed={isCollapsed}
      pathname={pathname}
      onSignOut={() => signOutForm.current?.requestSubmit()}
    />
  );

  return (
    <div className="flex h-dvh overflow-hidden">
      {/* Desktop sidebar */}
      <aside
        aria-label="Sidebar"
        className={cn(
          "hidden shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-200 md:flex",
          collapsed ? "w-[4.5rem]" : "w-64",
        )}
      >
        {sidebar(collapsed)}
      </aside>

      {/* Mobile drawer */}
      <Dialog open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DialogContent title="Navigation" hideTitle side="left" className="p-0">
          <div className="-mt-4 flex h-full flex-col">{sidebar(false)}</div>
        </DialogContent>
      </Dialog>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border bg-background/80 px-3 backdrop-blur sm:px-5">
          <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open navigation menu" onClick={() => setDrawerOpen(true)}>
            <Menu className="h-5 w-5" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="hidden md:inline-flex"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-pressed={collapsed}
            onClick={toggleCollapsed}
          >
            {collapsed ? <ChevronsRight className="h-5 w-5" aria-hidden="true" /> : <ChevronsLeft className="h-5 w-5" aria-hidden="true" />}
          </Button>
          <div className="flex min-w-0 flex-1 justify-center md:justify-start">
            <SearchBox />
          </div>
          <QuickCreate />
          <ThemeToggle />
        </header>

        <main id="main" className="min-h-0 flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Sign-out is a real form POST so the server can clear the session cookie. */}
      <form ref={signOutForm} action="/auth/signout" method="post" className="hidden" />
    </div>
  );
}

function SidebarContent({
  user,
  conversations,
  collapsed,
  pathname,
  onSignOut,
}: {
  user: ShellUser;
  conversations: ShellConversation[];
  collapsed: boolean;
  pathname: string;
  onSignOut: () => void;
}) {
  return (
    <>
      <div className={cn("flex h-16 shrink-0 items-center px-4", collapsed && "justify-center px-2")}>
        <Logo compact={collapsed} href="/dashboard" />
      </div>

      <nav aria-label="Primary" className="px-3">
        <ul className="space-y-1">
          {NAV.map((item) => {
            const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                    collapsed && "justify-center px-0",
                    active ? "bg-primary/15 text-foreground" : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
                  )}
                >
                  <item.icon className={cn("h-[1.15rem] w-[1.15rem] shrink-0", active && "text-primary")} aria-hidden="true" />
                  <span className={cn(collapsed && "sr-only")}>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-5 min-h-0 flex-1 overflow-y-auto px-3">
        {collapsed ? null : (
          <section aria-labelledby="recent-heading">
            <h2 id="recent-heading" className="px-3 pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Recent conversations
            </h2>
            {conversations.length === 0 ? (
              <p className="px-3 text-sm text-muted-foreground">No conversations yet.</p>
            ) : (
              <ul className="space-y-0.5">
                {conversations.map((c) => {
                  const active = pathname === `/chat/${c.id}`;
                  return (
                    <li key={c.id}>
                      <Link
                        href={`/chat/${c.id}`}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm",
                          active ? "bg-surface-2 text-foreground" : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
                        )}
                      >
                        <MessageSquare className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span className="truncate">{c.title}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}
      </div>

      {/* Account profile at the bottom */}
      <div className="shrink-0 border-t border-border p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Account menu"
              className={cn(
                "flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-surface-2",
                collapsed && "justify-center",
              )}
            >
              <Avatar name={user.name} src={user.avatarUrl} />
              {collapsed ? null : (
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{user.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-60">
            <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <Settings className="h-4 w-4" aria-hidden="true" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onSignOut}>
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
}
