"use client";

import React, { ElementRef, useCallback, useEffect, useRef, useState } from "react";
import Link from 'next/link';
import Image from 'next/image';
import { useParams, usePathname, useRouter } from "next/navigation";
import { useTheme } from 'next-themes';
import { useMediaQuery } from "usehooks-ts";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import {
  ChevronLeft,
  MenuIcon,
  PlusCircle,
  Search,
  Settings,
  Trash,
  Sun,
  Moon,
  Monitor,
  Check,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { UserItem } from "./user-item";
import { api } from "@/convex/_generated/api";
import { Item } from "./item";
import DocumentList from "./DocumentList";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { Trashbox } from "./Trashbox";
import { useSearch } from "@/hooks/use-search";
import { Navbar } from "./Navbar";

const Navigation = () => {
  const params = useParams();
  const pathname = usePathname();
  const { resolvedTheme, theme, setTheme } = useTheme();
  const search = useSearch();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const router = useRouter();

  const isResizingRef = useRef(false);
  const sidebarRef = useRef<ElementRef<"aside">>(null);
  const navbarRef = useRef<ElementRef<"div">>(null);

  const [isResetting, setIsResetting] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(isMobile);


  const create = useMutation(api.forms.create);

  // Mouse drag start
  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    isResizingRef.current = true;
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  // Handle sidebar resize
  const handleMouseMove = (event: MouseEvent) => {
    if (!isResizingRef.current) return;
    let newWidth = event.clientX;

    if (newWidth < 240) newWidth = 240;
    if (newWidth > 480) newWidth = 480;

    if (sidebarRef.current && navbarRef.current && !isMobile) {
      sidebarRef.current.style.width = `${newWidth}px`;
      navbarRef.current.style.setProperty("left", `${newWidth}px`);
      navbarRef.current.style.setProperty(
        "width",
        `calc(100% - ${newWidth}px)`
      );
    }
  };

  // Mouse drag end
  const handleMouseUp = () => {
    isResizingRef.current = false;
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  };

  // Reset to default expanded sidebar
  const resetWidth = useCallback(() => {
    if (sidebarRef.current && navbarRef.current) {
      setIsCollapsed(false);
      setIsResetting(true);

      sidebarRef.current.style.width = isMobile ? "100%" : "240px";
      navbarRef.current.style.setProperty(
        "width",
        isMobile ? "0" : "calc(100% - 240px)"
      );
      navbarRef.current.style.setProperty("left", isMobile ? "100%" : "240px");

      setTimeout(() => setIsResetting(false), 300);
    }
  }, [isMobile]);

  // Collapse sidebar
  const collapse = useCallback(() => {
    if (sidebarRef.current && navbarRef.current) {
      setIsCollapsed(true);
      setIsResetting(true);

      sidebarRef.current.style.width = "0";
      navbarRef.current.style.setProperty("width", "100%");
      navbarRef.current.style.setProperty("left", "0");

      setTimeout(() => setIsResetting(false), 300);
    }
  }, []);

  // Collapse/Expand based on screen size
  useEffect(() => {
    if (isMobile) {
      collapse();
    } else {
      resetWidth();
    }
  }, [isMobile, collapse, resetWidth]);

  useEffect(() => {
    if (isMobile) {
      collapse();
    }
  }, [pathname, isMobile, collapse]);

  // Close sidebar on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isCollapsed) collapse();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isCollapsed, collapse]);

  // Handle new form creation
  const handleCreate = () => {
    const promise = create({ title: "Untitled" })
    .then(( documentId ) => {
      router.push(`/forms/${documentId}`);
      
      
    });
    toast.promise(promise, {
      loading: "Creating...",
      success: "Note created successfully!",
      error: "Failed to create.",
    });
  };

  return (
    <>
      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        className={cn(
          "group/sidebar h-full bg-secondary dark:bg-[#0C0C0C] overflow-y-auto relative flex flex-col w-60 z-[99999]",
          isResetting && "transition-all ease-in-out duration-300",
          isMobile && "w-0"
        )}
      >
        {/* Collapse button */}
        <div
          role="button"
          onClick={collapse}
          className={cn(
            "absolute top-3 right-2 h-6 w-6 text-muted-foreground rounded-sm hover:bg-neutral-300 dark:hover:bg-neutral-600 opacity-0 group-hover/sidebar:opacity-100 transition",
            isMobile && "opacity-100"
          )}
        >
          <ChevronLeft className="h-6 w-6" />
        </div>

        {/* Sidebar content */}
        <div>
          {/* Logo — clickable, navigates to home */}
          <div className="px-3 py-3">
            <Link href="/" className="flex items-center gap-x-2">
              <Image
                src={resolvedTheme === 'dark' ? '/logo-dark.svg' : '/logo.svg'}
                alt="Home"
                width={32}
                height={32}
                className="h-8 w-auto"
              />
            </Link>
          </div>

          <UserItem />
          <Item label="Search" icon={Search} isSearch onClick={search.onOpen} />
          <Popover>
            <PopoverTrigger className="w-full">
              <Item label="Settings" icon={Settings} />
            </PopoverTrigger>
            <PopoverContent side="right" align="start" className="w-56 p-2">
              <div className="mb-1 px-2 py-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Appearance</p>
              </div>
              {([
                { value: "light",  label: "Light",  Icon: Sun },
                { value: "dark",   label: "Dark",   Icon: Moon },
                { value: "system", label: "System", Icon: Monitor },
              ] as const).map(({ value, label, Icon }) => (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  className={cn(
                    "w-full flex items-center gap-x-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                    "hover:bg-neutral-200 dark:hover:bg-neutral-700",
                    theme === value && "bg-neutral-200 dark:bg-neutral-700 font-medium"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 text-left">{label}</span>
                  {theme === value && <Check className="h-3.5 w-3.5 text-primary" />}
                </button>
              ))}
            </PopoverContent>
          </Popover>
          <Item onClick={handleCreate} label="New Note" icon={PlusCircle} />

        </div>

        <div className="mt-4">
          <DocumentList />
          <Popover>
            <PopoverTrigger className="w-full mt-4">
              <Item label="Trash" icon={Trash} />
            </PopoverTrigger>
            <PopoverContent
              side={isMobile ? "bottom" : "right"}
              className="p-0 w-72"
            >
              <Trashbox />
            </PopoverContent>
          </Popover>
        </div>

        {/* Resize handle (desktop only) */}
        {!isMobile && (
          <div
            role="button"
            onMouseDown={handleMouseDown}
            onClick={resetWidth}
            className="absolute right-0 top-0 h-full w-1 bg-primary/10 opacity-0 group-hover/sidebar:opacity-100 transition cursor-ew-resize"
          />
        )}
      </aside>

      {/* Navbar */}
      <div
        ref={navbarRef}
        className={cn(
          "absolute top-0 left-60 z-[99999] w-[calc(100%-240px)]",
          isResetting && "transition-all ease-in-out duration-300",
          isMobile && "left-0 w-full"
        )}
      >
        {!!params?.formId ? (
          <Navbar isCollapsed={isCollapsed} onResetWidth={resetWidth} />
        ) : (
          <nav className="bg-transparent px-3 py-2 w-full flex items-center">
            {isCollapsed && (
              <MenuIcon
                role="button"
                className="h-6 w-6 text-muted-foreground cursor-pointer"
                onClick={resetWidth}
              />
            )}
          </nav>
        )}
      </div>


    </>
  );
};

export default Navigation;
