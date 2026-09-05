import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "./shell/AppShell.js";
import { AuthLayout } from "./shell/AuthLayout.js";
import { LoginPage } from "./screens/LoginPage.js";
import { RepositoriesPage } from "./screens/RepositoriesPage.js";
import { RepositoryDetailPage } from "./screens/RepositoryDetailPage.js";

export const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: [
      {
        element: <LoginPage />,
        path: "/login",
      },
    ],
  },
  {
    element: <AppShell />,
    path: "/",
    children: [
      {
        index: true,
        element: <RepositoriesPage />,
      },
      {
        element: <RepositoryDetailPage />,
        path: "repositories/:repositoryId",
      },
      {
        element: <Navigate to="/" replace />,
        path: "*",
      },
    ],
  },
]);
