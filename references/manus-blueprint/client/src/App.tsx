import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import ProjectWorkspace from "./pages/ProjectWorkspace";
import ProductionStudio from "./pages/ProductionStudio";
import SettingsPage from "./pages/SettingsPage";
import StyleLibraryPage from "./pages/StyleLibraryPage";
import CollaborationDeskPage from "./pages/CollaborationDeskPage";
import BlindReviewPage from "./pages/BlindReviewPage";
import ApprovalInboxPage from "./pages/ApprovalInboxPage";
import JoinCollaborationPage from "./pages/JoinCollaborationPage";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/projects/:id/production"} component={ProductionStudio} />
      <Route path={"/projects/:id/collaboration"} component={CollaborationDeskPage} />
      <Route path={"/projects/:id/approvals"} component={ApprovalInboxPage} />
      <Route path={"/projects/:id"} component={ProjectWorkspace} />
      <Route path={"/style-library"} component={StyleLibraryPage} />
      <Route path={"/reviews/:id"} component={BlindReviewPage} />
      <Route path={"/join"} component={JoinCollaborationPage} />
      <Route path={"/settings"} component={SettingsPage} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="dark"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
