import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signup } from "@/lib/auth-actions";

export function SignUpForm() {
  return (
    <div className="bg-gradient-to-br from-purple-100 via-white to-blue-100 dark:from-slate-800 dark:via-slate-900 dark:to-slate-800 p-1 rounded-2xl shadow-2xl max-w-sm mx-auto">
      <Card className="rounded-2xl shadow-lg backdrop-blur bg-white/80 dark:bg-slate-900/80">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-purple-700 dark:text-purple-300">Sign Up</CardTitle>
          <CardDescription className="text-base text-gray-600 dark:text-gray-400">
            Create your account to get started.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action="">
            <div className="grid gap-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="first-name" className="text-base">First name</Label>
                  <Input
                    name="first-name"
                    id="first-name"
                    placeholder="Max"
                    required
                    className="rounded-lg border-gray-300 focus:border-purple-500 focus:ring-purple-500"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="last-name" className="text-base">Last name</Label>
                  <Input
                    name="last-name"
                    id="last-name"
                    placeholder="Robinson"
                    required
                    className="rounded-lg border-gray-300 focus:border-purple-500 focus:ring-purple-500"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email" className="text-base">Email</Label>
                <Input
                  name="email"
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  required
                  className="rounded-lg border-gray-300 focus:border-purple-500 focus:ring-purple-500"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password" className="text-base">Password</Label>
                <Input name="password" id="password" type="password" required className="rounded-lg border-gray-300 focus:border-purple-500 focus:ring-purple-500" />
              </div>
              <Button type="submit" formAction={signup} className="w-full rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 shadow-md transition">
                Create Account
              </Button>
            </div>
          </form>
          {/* <div className="mt-6 text-center text-sm">
            Already have an account?{' '}
            <Link href="/" className="text-purple-600 dark:text-purple-400 hover:underline font-semibold">
              Login
            </Link>
          </div> */}
        </CardContent>
      </Card>
    </div>
  );
}
