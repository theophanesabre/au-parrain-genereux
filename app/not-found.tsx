import Link from "next/link";

export default function NotFound() {
  return (
    <main className="not-found">
      <p>Au Parrain Généreux</p>
      <h1>Cette page n’existe pas.</h1>
      <Link href="/">Retour à l’accueil</Link>
    </main>
  );
}
