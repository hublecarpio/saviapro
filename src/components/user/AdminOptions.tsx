import { Home, Inbox, Settings, UserPlus, Users } from 'lucide-react'
import { SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '../ui/sidebar'
import { Link } from 'react-router-dom'
const items = [
    {
        title: "Prompt maestro",
        url: "#",
        icon: Settings,
    },
    {
        title: "Usuarios Invitados",
        url: "#",
        icon: UserPlus,
    },
    {
        title: "Usuarios Registrados",
        url: "#",
        icon: Users,
    }
]
export const AdminOptions = () => {
    return (
        <>
            <SidebarGroupLabel className="text-muted-foreground">
                Panel de administrador
            </SidebarGroupLabel>
            <SidebarGroupContent>
                <SidebarMenu>
                    {items.map((item) => (
                        <SidebarMenuItem className='hover:bg-primary/30 rounded-md' key={item.title}>
                            <SidebarMenuButton asChild>
                                <Link to={item.url}>
                                    <item.icon />
                                    <span>{item.title}</span>
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    ))}
                </SidebarMenu>
            </SidebarGroupContent>
        </>
    )
}
