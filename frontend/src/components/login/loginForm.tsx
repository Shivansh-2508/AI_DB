import Link from "next/link"

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
import SignInWithGoogleButton from "./SignInWithGoogleButton"

export function LoginForm() {
  return (
    <div className="bg-gradient-to-br from-blue-100 via-white to-purple-100 dark:from-slate-800 dark:via-slate-900 dark:to-slate-800 p-1 rounded-2xl shadow-2xl max-w-sm mx-auto">
      <Card className="rounded-2xl shadow-lg backdrop-blur bg-white/80 dark:bg-slate-900/80">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-blue-700 dark:text-blue-300">Admin Login</CardTitle>
          <CardDescription className="text-base text-gray-600 dark:text-gray-400">
            Please enter the admin email and password to access the dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action="">
            <div className="grid gap-6">
              <div className="grid gap-2">
                <Label htmlFor="email" className="text-base">Admin Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="admin@example.com"
                  required
                  className="rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password" className="text-base">Password</Label>
                <Input id="password" name="password" type="password" required className="rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500" />
              </div>
              <Button type="submit" formAction={login} className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 shadow-md transition">
                Login
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
