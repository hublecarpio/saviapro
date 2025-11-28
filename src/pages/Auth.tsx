import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Login } from "@/components/user/Login";
const Auth = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <Card className="border-border shadow-lg">
          <CardHeader className="space-y-4 text-center pb-6">
            <div className="flex justify-center"></div>
            <div>
              <CardTitle className="text-3xl font-semibold">
                <img
                  className="w-1/2 mx-auto"
                  src="/uhd8c1.png"
                  alt="Logo BIEXT"
                  loading="lazy"
                />
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <Login />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
export default Auth;
