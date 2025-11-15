import { SidebarTrigger } from './ui/sidebar'
import { Loader2, LogOut, Sparkles, UserCog } from 'lucide-react'
import { Button } from './ui/button'
import { destroyUser } from '@/hooks/useLogout';
import { useNavigate } from 'react-router-dom';


export const NavBarUser = ({ user, setShowProfileEditor, isSigningOut }) => {

    const navigate = useNavigate();
    const handleSignOut = async () => {
        await destroyUser();
        navigate('/')
    };
    return (
        <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
            <div className="max-w-full mx-auto px-3 md:px-6 py-3 md:py-4 flex items-center justify-between">
                <div className="flex items-center gap-2 md:gap-3 min-w-0">
                    <SidebarTrigger className="-ml-1" />
                    <div className="flex items-center gap-2 md:gap-3 min-w-0">
                        <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <Sparkles className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-base md:text-lg font-semibold text-foreground">
                                SAVIA
                            </h1>
                            <p className="text-[10px] md:text-xs text-muted-foreground truncate max-w-[120px] md:max-w-none">
                                {user?.email}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {
                        setShowProfileEditor ? <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowProfileEditor(true)}
                            className="text-muted-foreground hover:text-foreground shrink-0"
                        >
                            <UserCog className="h-4 w-4 md:mr-2" />
                            <span className="hidden md:inline">Mi Perfil</span>
                        </Button> : ''
                    }
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleSignOut}
                        disabled={isSigningOut}
                        className="text-muted-foreground hover:text-foreground shrink-0"
                    >
                        {isSigningOut ? (
                            <Loader2 className="h-4 w-4 md:mr-2 animate-spin" />
                        ) : (
                            <LogOut className="h-4 w-4 md:mr-2" />
                        )}
                        <span className="hidden md:inline">{isSigningOut ? "Saliendo..." : "Salir"}</span>
                    </Button>
                </div>
            </div>
        </header>
    )
}
