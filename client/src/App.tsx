import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import Home from "@/pages/Home";
import Dashboard from "@/pages/Dashboard";
import Birds from "@/pages/Birds";
import Couples from "@/pages/Couples";
import Rings from "@/pages/Rings";
import Clutches from "@/pages/Clutches";
import ControlSheetPDF from "@/pages/ControlSheetPDF";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/dashboard"} component={Dashboard} />
      <Route path={"/birds"} component={Birds} />
      <Route path={"/couples"} component={Couples} />
      <Route path={"/rings"} component={Rings} />
      <Route path={"/clutches"} component={Clutches} />
      <Route path={"/control-sheet/:coupleId"} component={ControlSheetPDF} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
