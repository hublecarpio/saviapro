import { useLocation, Link } from "react-router-dom";
import { SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '../ui/sidebar'
import { Settings, UserPlus, Users } from 'lucide-react'

const items = [
    {
        title: "Lista de estudiantes",
        url: "/tutor",
        icon: Users,
    }
]

export const TutorOptions = () => {
    const location = useLocation();

    return (
        <>
            <SidebarGroupLabel className="text-muted-foreground">
                Panel de tutor
            </SidebarGroupLabel>

            <SidebarGroupContent>
                <SidebarMenu>
                    {items.map((item) => {
                        const isActive = location.pathname === item.url;

                        return (
                            <SidebarMenuItem
                                key={item.title}
                                className={`
                                    rounded-sm
                                    ${isActive ? "bg-primary/30 text-black" : "hover:bg-slate-100"}
                                `}
                            >
                                <SidebarMenuButton asChild>
                                    <Link to={item.url}>
                                        <item.icon />
                                        <span>{item.title}</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        );
                    })}
                </SidebarMenu>
            </SidebarGroupContent>
        </>
    );
};
