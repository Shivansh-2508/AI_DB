// src/lib/api.ts
const BASE_URL = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:5000"; // Removed /api

interface LoginResponse {
  access_token: string;
  user: {
    id: string;
    email: string;
    [key: string]: unknown;
  };
}

interface SignupResponse {
  message?: string;
  user?: {
    id: string;
    email: string;
  };
}

export interface ProtectedResponse {
  user: {
    id: string;
    email: string;
    [key: string]: unknown;
  };
  message?: string;
}

async function signup(email: string, password: string): Promise<SignupResponse> {
  console.log("Attempting signup for:", email);
  
  const res = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  console.log("Signup response status:", res.status);

  if (!res.ok) {
    let errorMessage;
    try {
      const err = await res.json();
      errorMessage = err.error || err.message || `Signup failed with status ${res.status}`;
    } catch {
      errorMessage = `Signup failed with status ${res.status}`;
    }
    throw new Error(errorMessage);
  }

  const result = await res.json();
  console.log("Signup success:", result);
  return result;
}

async function login(email: string, password: string): Promise<LoginResponse> {
  console.log("Attempting login for:", email);
  
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  console.log("Login response status:", res.status);

  if (!res.ok) {
    let errorMessage;
    try {
      const err = await res.json();
      console.error("Login error details:", err);
      errorMessage = err.error || err.message || `Login failed with status ${res.status}`;
    } catch {
      const textError = await res.text();
      console.error("Login error text:", textError);
      errorMessage = `Login failed with status ${res.status}`;
    }
    throw new Error(errorMessage);
  }

  const result = await res.json();
  console.log("Login success. Token received:", !!result.access_token);
  return result;
}

async function getProtected(accessToken: string): Promise<ProtectedResponse> {
  console.log("🔍 Making protected request...");
  console.log("🔑 Token preview:", accessToken.substring(0, 20) + "...");
  
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${accessToken}`,
  };

  console.log("📤 Request headers:", headers);

  const res = await fetch(`${BASE_URL}/api/auth/protected`, {
    method: "GET",
    headers,
  });

  console.log("📥 Response status:", res.status);
  console.log("📥 Response headers:", Object.fromEntries(res.headers.entries()));

  // Always try to get the response body for debugging
  let responseBody;
  let isJson = false;

  try {
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      responseBody = await res.json();
      isJson = true;
      console.log("📄 Response JSON:", responseBody);
    } else {
      responseBody = await res.text();
      console.log("📄 Response Text:", responseBody);
    }
  } catch (parseError) {
    console.error("❌ Error parsing response:", parseError);
    responseBody = { error: "Could not parse response" };
  }

  if (!res.ok) {
    let errorMessage;
    
    if (isJson && responseBody) {
      errorMessage = responseBody.error || responseBody.message || responseBody.detail || `Protected request failed with status ${res.status}`;
      console.error("❌ API Error (JSON):", responseBody);
    } else {
      errorMessage = responseBody || `Protected request failed with status ${res.status}`;
      console.error("❌ API Error (Text):", responseBody);
    }
    
    // Log the full error details for debugging
    console.error("❌ Full error context:", {
      status: res.status,
      statusText: res.statusText,
      headers: Object.fromEntries(res.headers.entries()),
      body: responseBody
    });
    
    throw new Error(errorMessage);
  }

  console.log("✅ Protected route success:", responseBody);
  return responseBody;
}

// Helper function to test different authorization header formats
async function testProtectedWithDifferentHeaders(accessToken: string) {
  const testCases = [
    { name: "Bearer Token", headers: { "Authorization": `Bearer ${accessToken}` }},
    { name: "Direct Token", headers: { "Authorization": accessToken }},
    { name: "X-Access-Token", headers: { "x-access-token": accessToken }},
    { name: "X-Auth-Token", headers: { "x-auth-token": accessToken }},
    { name: "Token Header", headers: { "token": accessToken }},
  ];

  console.log("🧪 Testing different header formats...");

  for (const testCase of testCases) {
    try {
      console.log(`\n🔬 Testing: ${testCase.name}`);
      
      const res = await fetch(`${BASE_URL}/api/auth/protected`, {
        method: "GET",
        headers: Object.fromEntries(
          Object.entries({
            "Content-Type": "application/json",
            ...testCase.headers,
          }).filter((entry) => entry[1] !== undefined)
        ),
      });

      console.log(`📊 ${testCase.name} - Status: ${res.status}`);
      
      if (res.ok) {
        const data = await res.json();
        console.log(`✅ ${testCase.name} - SUCCESS!`, data);
        return { success: true, format: testCase.name, data };
      } else {
        const errorText = await res.text();
        console.log(`❌ ${testCase.name} - Failed:`, errorText);
      }
    } catch (error) {
      console.log(`❌ ${testCase.name} - Error:`, error);
    }
  }
  
  return { success: false };
}

const api = {
  signup,
  login,
  getProtected,
  testProtectedWithDifferentHeaders, // Export for debugging
};

export default api;