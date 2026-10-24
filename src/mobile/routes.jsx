import useIsMobile from "../lib/useIsMobile";
import Home from "../pages/Home";
import RaceDetail from "../pages/RaceDetail";
import Account from "../pages/Account";
import MobileHome from "./MobileHome";
import MobileList from "./MobileList";
import MobileMap from "./MobileMap";
import MobileRaceDetail from "./MobileRaceDetail";
import MobileAccount from "./MobileAccount";
import "./mobile.css";

// Sous 820px, les écrans principaux basculent sur leur version
// « application » ; au-delà, le site reste strictement identique.
export function HomeRoute({ view = "home" }) {
  const isMobile = useIsMobile();
  if (!isMobile) return <Home />;
  if (view === "map") return <MobileMap />;
  if (view === "list") return <MobileList />;
  return <MobileHome />;
}

export function RaceRoute() {
  return useIsMobile() ? <MobileRaceDetail /> : <RaceDetail />;
}

export function AccountRoute() {
  return useIsMobile() ? <MobileAccount /> : <Account />;
}

// Écrans qui ont leur propre en-tête façon app : le header du site s'efface.
export function isAppScreen(pathname) {
  return ["/", "/ultras", "/carte", "/account"].includes(pathname) || pathname.startsWith("/courses/");
}
