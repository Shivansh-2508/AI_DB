
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { LoginForm } from "@/components/login/loginForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Home() {
  const router = useRouter();
  const supabase = createClient();
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        router.replace("/chat");
      }
    };
    checkUser();
  }, [router, supabase.auth]);

  // Manage body scroll when modal opens/closes
  useEffect(() => {
    if (showAdminModal) {
      // Don't prevent body scroll on mobile - just add modal-open class
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }

    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [showAdminModal]);

  const handleAdminLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    
    const formData = new FormData(e.currentTarget);
    
    try {
      const email = formData.get("email") as string;
      const password = formData.get("password") as string;
      
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (authError) {
        setError(authError.message);
        return;
      }
      
      setShowAdminModal(false);
      router.push("/chat");
    } catch (error) {
      console.error("Login failed:", error);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative" style={{ backgroundColor: '#FEFCF6' }} data-scroll-container>
      {/* Geometric Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Floating geometric shapes - responsive positioning */}
        <div className="absolute top-4 left-2 xs:top-6 xs:left-3 sm:top-8 sm:left-4 lg:top-16 lg:left-8 w-8 h-8 xs:w-10 xs:h-10 sm:w-12 sm:h-12 lg:w-20 lg:h-20 xl:w-24 xl:h-24 opacity-10 animate-pulse" style={{ animationDelay: '0s', animationDuration: '4s' }}>
          <div className="w-full h-full rounded-full" style={{ backgroundColor: '#162A2C' }}></div>
        </div>
        <div className="absolute top-8 right-2 xs:top-12 xs:right-3 sm:top-16 sm:right-4 lg:top-24 lg:right-8 w-6 h-6 xs:w-7 xs:h-7 sm:w-8 sm:h-8 lg:w-14 lg:h-14 xl:w-16 xl:h-16 opacity-15 animate-pulse" style={{ animationDelay: '1s', animationDuration: '3s' }}>
          <div className="w-full h-full" style={{ backgroundColor: '#D3C3B9', clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }}></div>
        </div>
        <div className="absolute bottom-16 left-1/4 xs:bottom-18 sm:bottom-24 lg:bottom-20 w-7 h-7 xs:w-8 xs:h-8 sm:w-10 sm:h-10 lg:w-16 lg:h-16 xl:w-18 xl:h-18 opacity-10 animate-pulse" style={{ animationDelay: '2s', animationDuration: '5s' }}>
          <div className="w-full h-full transform rotate-45" style={{ backgroundColor: '#162A2C' }}></div>
        </div>
        <div className="absolute bottom-4 right-2 xs:bottom-6 xs:right-3 sm:bottom-8 sm:right-4 lg:bottom-12 lg:right-8 w-6 h-6 xs:w-7 xs:h-7 sm:w-8 sm:h-8 lg:w-12 lg:h-12 xl:w-14 xl:h-14 opacity-20 animate-pulse" style={{ animationDelay: '0.5s', animationDuration: '3.5s' }}>
          <div className="w-full h-full rounded-full" style={{ backgroundColor: '#D3C3B9' }}></div>
        </div>
        
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, #162A2C 1px, transparent 0)`,
          backgroundSize: '20px 20px'
        }}></div>
        
        {/* Mobile-specific smaller grid for very small screens */}
        <div className="absolute inset-0 opacity-5 xs:hidden" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, #162A2C 1px, transparent 0)`,
          backgroundSize: '15px 15px'
        }}></div>
      </div>

      {/* Header */}
      <header className="relative z-20 flex justify-between items-center px-3 xs:px-4 sm:px-6 lg:px-8 py-3 xs:py-4 sm:py-6">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 xs:w-8 xs:h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#162A2C' }}>
            <span className="text-sm xs:text-lg sm:text-xl font-bold" style={{ color: '#FEFCF6' }}>A</span>
          </div>
          <span className="text-base xs:text-lg sm:text-xl font-bold" style={{ color: '#162A2C' }}>AiDb</span>
        </div>
        
        <Button 
          onClick={() => {
            setShowAdminModal(true);
            setError(null);
          }}
          className="px-2 xs:px-3 sm:px-4 py-1.5 xs:py-2 rounded-lg font-medium transition-all duration-300 hover:scale-105 text-xs xs:text-sm"
          style={{ 
            backgroundColor: '#D3C3B9',
            color: '#162A2C',
            border: '2px solid #D3C3B9'
          }}
        >
          <span className="hidden xs:inline">Admin Login</span>
          <span className="xs:hidden">Admin Login</span>
        </Button>
      </header>

      {/* Main Content */}
      <div className="relative z-10 px-3 xs:px-4 py-4 xs:py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-12">
        {/* Hero Section */}
        <div className="max-w-7xl mx-auto text-center mb-8 xs:mb-12 sm:mb-16 lg:mb-20">
          <div className="group cursor-pointer mb-4 xs:mb-6">
            <h1 className="text-3xl xs:text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-bold mb-3 xs:mb-4 transition-all duration-300 group-hover:scale-105" style={{ color: '#162A2C' }}>
              <span className="inline-block animate-[float_3s_ease-in-out_infinite]">A</span>
              <span className="inline-block animate-[float_3s_ease-in-out_infinite_0.1s]">i</span>
              <span className="inline-block animate-[float_3s_ease-in-out_infinite_0.2s]">D</span>
              <span className="inline-block animate-[float_3s_ease-in-out_infinite_0.3s]">b</span>
            </h1>
          </div>
          
          <div className="space-y-2 xs:space-y-3 sm:space-y-4 mb-6 xs:mb-8">
            <p className="text-lg xs:text-xl sm:text-2xl md:text-3xl lg:text-4xl font-semibold animate-[slideInFromLeft_0.8s_ease-out_0.2s_both]" style={{ color: '#162A2C' }}>
              Your AI-Powered Database Assistant
            </p>
            <p className="text-sm xs:text-base sm:text-lg md:text-xl opacity-80 max-w-xs xs:max-w-sm sm:max-w-2xl md:max-w-3xl lg:max-w-4xl mx-auto px-2 xs:px-0 animate-[slideInFromLeft_0.8s_ease-out_0.4s_both]" style={{ color: '#162A2C' }}>
              Transform natural language into powerful SQL queries with cutting-edge artificial intelligence
            </p>
          </div>
          
          <div className="w-16 xs:w-20 sm:w-24 h-1 rounded-full mx-auto mb-8 xs:mb-12 animate-[expandWidth_1s_ease-out_0.6s_both]" style={{ backgroundColor: '#D3C3B9' }}></div>
        </div>

        {/* What is AiDb Section */}
        <div className="max-w-7xl mx-auto mb-12 xs:mb-16 sm:mb-20">
          <div className="text-center mb-8 xs:mb-10 sm:mb-12">
            <h2 className="text-2xl xs:text-3xl sm:text-4xl md:text-5xl font-bold mb-3 xs:mb-4" style={{ color: '#162A2C' }}>
              What is AiDb?
            </h2>
            <p className="text-base xs:text-lg opacity-80 max-w-xs xs:max-w-sm sm:max-w-2xl md:max-w-3xl lg:max-w-4xl mx-auto px-2 xs:px-0" style={{ color: '#162A2C' }}>
              AiDb is an innovative AI-powered database assistant that bridges the gap between natural language and complex database operations.
            </p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 xs:gap-8 lg:gap-12 items-center">
            <div className="space-y-4 xs:space-y-6 order-2 lg:order-1">
              <div className="p-4 xs:p-5 sm:p-6 rounded-xl backdrop-blur-sm border shadow-lg" style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', borderColor: '#D3C3B9' }}>
                <div className="flex items-center space-x-3 xs:space-x-4 mb-3 xs:mb-4">
                  <div className="w-10 h-10 xs:w-12 xs:h-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#162A2C' }}>
                    <span className="text-xl xs:text-2xl">🧠</span>
                  </div>
                  <h3 className="text-lg xs:text-xl font-bold" style={{ color: '#162A2C' }}>Intelligent Processing</h3>
                </div>
                <p className="opacity-80 text-sm xs:text-base" style={{ color: '#162A2C' }}>
                  Our advanced AI understands context, intent, and complex database relationships to generate accurate SQL queries from your natural language descriptions.
                </p>
              </div>
              
              <div className="p-4 xs:p-5 sm:p-6 rounded-xl backdrop-blur-sm border shadow-lg" style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', borderColor: '#D3C3B9' }}>
                <div className="flex items-center space-x-3 xs:space-x-4 mb-3 xs:mb-4">
                  <div className="w-10 h-10 xs:w-12 xs:h-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#D3C3B9' }}>
                    <span className="text-xl xs:text-2xl">🔄</span>
                  </div>
                  <h3 className="text-lg xs:text-xl font-bold" style={{ color: '#162A2C' }}>Real-time Translation</h3>
                </div>
                <p className="opacity-80 text-sm xs:text-base" style={{ color: '#162A2C' }}>
                  Instantly convert your questions and requests into optimized SQL queries, eliminating the need for manual query writing.
                </p>
              </div>
            </div>
            
            <div className="relative order-1 lg:order-2">
              <div className="absolute -inset-2 xs:-inset-4 rounded-2xl opacity-20 blur-lg animate-pulse" style={{ backgroundColor: '#D3C3B9' }}></div>
              <div className="relative p-4 xs:p-6 sm:p-8 rounded-xl border shadow-2xl" style={{ backgroundColor: 'rgba(255, 255, 255, 0.98)', borderColor: '#D3C3B9' }}>
                <div className="text-center space-y-3 xs:space-y-4">
                  <div className="w-16 h-16 xs:w-20 xs:h-20 mx-auto rounded-full flex items-center justify-center mb-3 xs:mb-4" style={{ backgroundColor: '#162A2C' }}>
                    <span className="text-3xl xs:text-4xl">💬</span>
                  </div>
                  <h4 className="text-base xs:text-lg font-semibold" style={{ color: '#162A2C' }}>Natural Language Input</h4>
                  <div className="p-3 xs:p-4 rounded-lg" style={{ backgroundColor: '#FEFCF6', border: '1px solid #D3C3B9' }}>
                    <p className="text-xs xs:text-sm italic" style={{ color: '#162A2C' }}>
                      &quot;Show me all customers who made purchases over $1000 last month&quot;
                    </p>
                  </div>
                  <div className="flex items-center justify-center space-x-1 xs:space-x-2">
                    <div className="w-1.5 h-1.5 xs:w-2 xs:h-2 rounded-full animate-bounce" style={{ backgroundColor: '#162A2C' }}></div>
                    <div className="w-1.5 h-1.5 xs:w-2 xs:h-2 rounded-full animate-bounce" style={{ backgroundColor: '#162A2C', animationDelay: '0.1s' }}></div>
                    <div className="w-1.5 h-1.5 xs:w-2 xs:h-2 rounded-full animate-bounce" style={{ backgroundColor: '#162A2C', animationDelay: '0.2s' }}></div>
                  </div>
                  <div className="p-3 xs:p-4 rounded-lg" style={{ backgroundColor: '#162A2C' }}>
                    <p className="text-xs xs:text-sm font-mono text-green-300">
                      SELECT * FROM customers c<br/>
                      JOIN orders o ON c.id = o.customer_id<br/>
                      WHERE o.amount &gt; 1000<br/>
                      AND o.date &gt;= DATEADD(month, -1, GETDATE())
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Key Features Section */}
        <div className="max-w-7xl mx-auto mb-12 xs:mb-16 sm:mb-20">
          <div className="text-center mb-8 xs:mb-10 sm:mb-12">
            <h2 className="text-2xl xs:text-3xl sm:text-4xl md:text-5xl font-bold mb-3 xs:mb-4" style={{ color: '#162A2C' }}>
              Key Features & Capabilities
            </h2>
            <p className="text-base xs:text-lg opacity-80 max-w-xs xs:max-w-sm sm:max-w-2xl md:max-w-3xl lg:max-w-4xl mx-auto px-2 xs:px-0" style={{ color: '#162A2C' }}>
              Discover the powerful features that make AiDb the perfect database companion for developers, analysts, and businesses.
            </p>
          </div>
          
          <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 gap-4 xs:gap-6 lg:gap-8">
            {[
              {
                icon: "🤖",
                title: "AI-Powered Queries",
                description: "Advanced natural language processing converts your questions into optimized SQL queries instantly."
              },
              {
                icon: "⚡",
                title: "Lightning Fast",
                description: "Experience sub-second query generation and execution with our optimized AI engine."
              },
              {
                icon: "🔒",
                title: "Enterprise Security",
                description: "Bank-level security with encryption, access controls, and audit trails for peace of mind."
              },
              {
                icon: "📊",
                title: "Smart Analytics",
                description: "Get intelligent insights and suggestions based on your data patterns and query history."
              },
              {
                icon: "🔄",
                title: "Multi-Database Support",
                description: "Works seamlessly with MySQL, PostgreSQL, SQL Server, Oracle, and more database systems."
              },
              {
                icon: "📱",
                title: "Responsive Design",
                description: "Access your database assistant from any device with our fully responsive web interface."
              }
            ].map((feature, index) => (
              <div 
                key={index}
                className="group p-4 xs:p-5 sm:p-6 rounded-xl backdrop-blur-sm border shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-xl"
                style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', borderColor: '#D3C3B9' }}
              >
                <div className="flex flex-col items-center text-center space-y-3 xs:space-y-4">
                  <div 
                    className="w-12 h-12 xs:w-14 xs:h-14 sm:w-16 sm:h-16 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-110"
                    style={{ backgroundColor: index % 2 === 0 ? '#162A2C' : '#D3C3B9' }}
                  >
                    <span className="text-2xl xs:text-3xl">{feature.icon}</span>
                  </div>
                  <h3 className="text-lg xs:text-xl font-bold transition-colors duration-300" style={{ color: '#162A2C' }}>
                    {feature.title}
                  </h3>
                  <p className="opacity-80 transition-opacity duration-300 group-hover:opacity-100 text-sm xs:text-base" style={{ color: '#162A2C' }}>
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Use Cases Section */}
        <div className="max-w-7xl mx-auto mb-12 xs:mb-16 sm:mb-20">
          <div className="text-center mb-8 xs:mb-10 sm:mb-12">
            <h2 className="text-2xl xs:text-3xl sm:text-4xl md:text-5xl font-bold mb-3 xs:mb-4" style={{ color: '#162A2C' }}>
              Perfect For Every Use Case
            </h2>
            <p className="text-base xs:text-lg opacity-80 max-w-xs xs:max-w-sm sm:max-w-2xl md:max-w-3xl lg:max-w-4xl mx-auto px-2 xs:px-0" style={{ color: '#162A2C' }}>
              Whether you&apos;re a developer, analyst, or business user, AiDb adapts to your specific needs and workflow.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 xs:gap-8">
            {[
              {
                title: "Developers",
                icon: "👨‍💻",
                points: [
                  "Rapid prototyping with instant query generation",
                  "Debug complex queries with AI assistance",
                  "Learn SQL best practices through examples",
                  "Integrate with existing development workflows"
                ]
              },
              {
                title: "Data Analysts",
                icon: "📈",
                points: [
                  "Generate complex analytical queries effortlessly",
                  "Explore data relationships through natural language",
                  "Create reports and dashboards faster",
                  "Validate data insights with AI recommendations"
                ]
              },
              {
                title: "Business Users",
                icon: "👔",
                points: [
                  "Access data without technical SQL knowledge",
                  "Get instant answers to business questions",
                  "Generate reports through conversational interface",
                  "Make data-driven decisions confidently"
                ]
              }
            ].map((useCase, index) => (
              <div 
                key={index}
                className="p-5 xs:p-6 sm:p-8 rounded-xl backdrop-blur-sm border shadow-lg"
                style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', borderColor: '#D3C3B9' }}
              >
                <div className="text-center mb-4 xs:mb-5 sm:mb-6">
                  <div 
                    className="w-12 h-12 xs:w-14 xs:h-14 sm:w-16 sm:h-16 mx-auto rounded-xl flex items-center justify-center mb-3 xs:mb-4"
                    style={{ backgroundColor: '#162A2C' }}
                  >
                    <span className="text-2xl xs:text-3xl">{useCase.icon}</span>
                  </div>
                  <h3 className="text-xl xs:text-2xl font-bold" style={{ color: '#162A2C' }}>
                    {useCase.title}
                  </h3>
                </div>
                <ul className="space-y-2 xs:space-y-3">
                  {useCase.points.map((point, pointIndex) => (
                    <li key={pointIndex} className="flex items-start space-x-2 xs:space-x-3">
                      <div 
                        className="w-1.5 h-1.5 xs:w-2 xs:h-2 rounded-full mt-2 flex-shrink-0"
                        style={{ backgroundColor: '#D3C3B9' }}
                      ></div>
                      <span className="opacity-80 text-sm xs:text-base" style={{ color: '#162A2C' }}>
                        {point}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Getting Started Section */}
        <div className="max-w-5xl mx-auto text-center mb-12 xs:mb-16">
          <div className="p-5 xs:p-6 sm:p-8 lg:p-12 rounded-xl backdrop-blur-sm border shadow-2xl" style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', borderColor: '#D3C3B9' }}>
            <h2 className="text-2xl xs:text-3xl sm:text-4xl md:text-5xl font-bold mb-4 xs:mb-6" style={{ color: '#162A2C' }}>
              Ready to Get Started?
            </h2>
            <p className="text-base xs:text-lg opacity-80 mb-6 xs:mb-8 max-w-xs xs:max-w-sm sm:max-w-2xl lg:max-w-3xl mx-auto px-2 xs:px-0" style={{ color: '#162A2C' }}>
              Join thousands of developers and analysts who are already using AiDb to revolutionize their database workflows.
            </p>
            
            <div className="space-y-4 xs:space-y-6">
              <LoginForm />
              
              <div className="pt-4 xs:pt-6 border-t" style={{ borderColor: '#D3C3B9' }}>
                <div className="flex justify-center space-x-6 xs:space-x-8 sm:space-x-12">
                  <div className="flex flex-col items-center group cursor-pointer transition-all duration-300 hover:scale-110">
                    <div 
                      className="w-10 h-10 xs:w-12 xs:h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center mb-1 xs:mb-2 transition-all duration-300 shadow-md group-hover:shadow-lg"
                      style={{ backgroundColor: '#D3C3B9' }}
                    >
                      <span className="text-lg xs:text-xl sm:text-2xl" style={{ color: '#162A2C' }}>🚀</span>
                    </div>
                    <span className="text-xs xs:text-sm font-medium transition-opacity duration-300 group-hover:opacity-100 opacity-70" style={{ color: '#162A2C' }}>
                      Quick Setup
                    </span>
                  </div>
                  
                  <div className="flex flex-col items-center group cursor-pointer transition-all duration-300 hover:scale-110">
                    <div 
                      className="w-10 h-10 xs:w-12 xs:h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center mb-1 xs:mb-2 transition-all duration-300 shadow-md group-hover:shadow-lg"
                      style={{ backgroundColor: '#162A2C' }}
                    >
                      <span className="text-lg xs:text-xl sm:text-2xl" style={{ color: '#FEFCF6' }}>💬</span>
                    </div>
                    <span className="text-xs xs:text-sm font-medium transition-opacity duration-300 group-hover:opacity-100 opacity-70" style={{ color: '#162A2C' }}>
                      24/7 Support
                    </span>
                  </div>
                  
                  <div className="flex flex-col items-center group cursor-pointer transition-all duration-300 hover:scale-110">
                    <div 
                      className="w-10 h-10 xs:w-12 xs:h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center mb-1 xs:mb-2 transition-all duration-300 shadow-md group-hover:shadow-lg"
                      style={{ backgroundColor: '#D3C3B9' }}
                    >
                      <span className="text-lg xs:text-xl sm:text-2xl" style={{ color: '#162A2C' }}>🎯</span>
                    </div>
                    <span className="text-xs xs:text-sm font-medium transition-opacity duration-300 group-hover:opacity-100 opacity-70" style={{ color: '#162A2C' }}>
                      Proven Results
                    </span>
                  </div>
                </div>
                
                <div className="mt-6 xs:mt-8 text-center">
                  <p className="text-xs xs:text-sm opacity-50" style={{ color: '#162A2C' }}>
                    Join thousands of developers already using AiDb to transform their database workflows
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Admin Login Modal */}
      {showAdminModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 xs:p-4 overflow-y-auto">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowAdminModal(false)}
          ></div>
          
          {/* Modal */}
          <div className="relative w-full max-w-sm xs:max-w-md animate-[slideInFromBottom_0.3s_ease-out] my-auto">
            <Card 
              className="shadow-2xl border-2 max-h-[90vh] overflow-y-auto"
              style={{ backgroundColor: '#FEFCF6', borderColor: '#D3C3B9' }}
            >
              <CardHeader className="text-center pb-4 xs:pb-6">
                <CardTitle 
                  className="text-xl xs:text-2xl font-bold flex items-center justify-center space-x-2"
                  style={{ color: '#162A2C' }}
                >
                  <div 
                    className="w-7 h-7 xs:w-8 xs:h-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: '#162A2C' }}
                  >
                    <span className="text-base xs:text-lg font-bold" style={{ color: '#FEFCF6' }}>A</span>
                  </div>
                  <span>Admin Access</span>
                </CardTitle>
                <CardDescription style={{ color: '#162A2C' }} className="text-sm xs:text-base">
                  Enter your admin credentials to access the dashboard
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 xs:px-6">
                <form onSubmit={handleAdminLogin}>
                  <div className="space-y-3 xs:space-y-4">
                    <div className="space-y-1 xs:space-y-2">
                      <Label 
                        htmlFor="admin-email" 
                        className="font-medium text-sm xs:text-base"
                        style={{ color: '#162A2C' }}
                      >
                        Admin Email
                      </Label>
                      <Input
                        id="admin-email"
                        name="email"
                        type="email"
                        placeholder="admin@aidb.com"
                        required
                        className="border-2 transition-all duration-300 focus:scale-[1.01] h-10 xs:h-11 text-sm xs:text-base"
                        style={{ 
                          borderColor: '#D3C3B9',
                          color: '#162A2C'
                        }}
                      />
                    </div>
                    <div className="space-y-1 xs:space-y-2">
                      <Label 
                        htmlFor="admin-password" 
                        className="font-medium text-sm xs:text-base"
                        style={{ color: '#162A2C' }}
                      >
                        Password
                      </Label>
                      <Input 
                        id="admin-password" 
                        name="password" 
                        type="password" 
                        placeholder="••••••••"
                        required 
                        className="border-2 transition-all duration-300 focus:scale-[1.01] h-10 xs:h-11 text-sm xs:text-base"
                        style={{ 
                          borderColor: '#D3C3B9',
                          color: '#162A2C'
                        }}
                      />
                    </div>
                    
                    {/* Error Display */}
                    {error && (
                      <div className="p-3 rounded-lg border" style={{ 
                        backgroundColor: '#FEE2E2', 
                        borderColor: '#FECACA',
                        color: '#991B1B'
                      }}>
                        <p className="text-xs xs:text-sm font-medium">{error}</p>
                      </div>
                    )}
                    
                    <div className="flex space-x-2 pt-3 xs:pt-4">
                      <Button 
                        type="button"
                        variant="outline"
                        onClick={() => setShowAdminModal(false)}
                        disabled={isLoading}
                        className="flex-1 border-2 font-medium transition-all duration-300 h-10 xs:h-11 text-sm xs:text-base"
                        style={{ 
                          borderColor: '#D3C3B9',
                          color: '#162A2C'
                        }}
                      >
                        Cancel
                      </Button>
                      <Button 
                        type="submit"
                        disabled={isLoading}
                        className="flex-1 font-semibold border-2 transition-all duration-300 hover:scale-[1.02] h-10 xs:h-11 text-sm xs:text-base"
                        style={{ 
                          backgroundColor: '#162A2C',
                          borderColor: '#162A2C',
                          color: '#FEFCF6'
                        }}
                      >
                        {isLoading ? (
                          <span className="flex items-center justify-center gap-2">
                            <div className="w-3 h-3 xs:w-4 xs:h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span className="hidden xs:inline">Signing In...</span>
                            <span className="xs:hidden">...</span>
                          </span>
                        ) : (
                          <>
                            <span className="hidden xs:inline">Sign In →</span>
                            <span className="xs:hidden">Sign In</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
