import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { login } from "@/lib/auth-actions"

export function LoginForm() {
  return (
    <div className="w-full">
      <Card 
        className="border-0 shadow-none bg-transparent"
      >
        <CardHeader className="text-center pb-2 sm:pb-3 px-0">
          <CardTitle 
            className="text-base sm:text-lg font-bold mb-1 transition-all duration-300"
            style={{ color: '#162A2C' }}
          >
            Admin Access
          </CardTitle>
          <CardDescription 
            className="opacity-70 text-xs sm:text-sm"
            style={{ color: '#162A2C' }}
          >
            Enter your credentials to access the dashboard
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <form>
            <div className="grid gap-2 sm:gap-3">
              <div className="grid gap-1 sm:gap-2">
                <Label 
                  htmlFor="email" 
                  className="font-medium transition-all duration-300 text-xs sm:text-sm"
                  style={{ color: '#162A2C' }}
                >
                  Admin Email
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="admin@aidb.com"
                  required
                  className="rounded-lg border-2 transition-all duration-300 focus:scale-[1.01] hover:shadow-sm bg-white/90 backdrop-blur-sm h-9 sm:h-10 text-xs sm:text-sm"
                  style={{ 
                    borderColor: '#D3C3B9',
                    color: '#162A2C'
                  }}
                />
              </div>
              <div className="grid gap-1 sm:gap-2">
                <Label 
                  htmlFor="password" 
                  className="font-medium transition-all duration-300 text-xs sm:text-sm"
                  style={{ color: '#162A2C' }}
                >
                  Password
                </Label>
                <Input 
                  id="password" 
                  name="password" 
                  type="password" 
                  placeholder="••••••••"
                  required 
                  className="rounded-lg border-2 transition-all duration-300 focus:scale-[1.01] hover:shadow-sm bg-white/90 backdrop-blur-sm h-9 sm:h-10 text-xs sm:text-sm"
                  style={{ 
                    borderColor: '#D3C3B9',
                    color: '#162A2C'
                  }}
                />
              </div>
              <Button 
                type="submit" 
                formAction={login} 
                className="w-full rounded-lg font-semibold py-2 sm:py-3 text-sm sm:text-base shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-[1.01] active:scale-[0.99] border-2 mt-2"
                style={{ 
                  backgroundColor: '#162A2C',
                  borderColor: '#162A2C',
                  color: '#FEFCF6'
                }}
              >
                <span className="flex items-center justify-center gap-2">
                  Sign In
                  <span className="text-sm sm:text-base">→</span>
                </span>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
