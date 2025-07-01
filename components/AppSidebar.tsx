'use client';

import { Home, Package, Rocket, Settings, Ship } from "lucide-react"
import Link from "next/link";
import { useAuth } from '@/contexts/AuthContext';

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"

// Menu items.
const menuItems = [
  {
    title: "Home",
    url: "/",
    icon: Home,
    authRequired: false,
  },
  {
    title: "Standard Deploy",
    url: "/deploy",
    icon: Rocket,
    authRequired: true,
  },
  {
    title: "Canary Deploy",
    url: "/canary-deploy",
    icon: Ship,
    authRequired: true,
  },
  {
    title: "Dark Release",
    url: "/dark-release",
    icon: Package,
    authRequired: true,
  },
  {
    title: "About",
    url: "/settings",
    icon: Settings,
    authRequired: true,
  },
]

export function AppSidebar() {
  const { state: sidebarState } = useSidebar();
  const { isLoggedIn } = useAuth();

  const filteredMenuItems = menuItems.filter(item => !item.authRequired || isLoggedIn);

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          {/* Header for the sidebar content, including the MeshManager label and the trigger */} 
          <div className="flex items-center justify-between p-2">
            <SidebarGroupLabel className="flex-grow">MeshManager</SidebarGroupLabel>
            {sidebarState === "expanded" && (
              <SidebarTrigger className="flex-shrink-0" />
            )}
          </div>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <Link href={item.url} passHref>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}