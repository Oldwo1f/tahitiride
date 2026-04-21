<script setup lang="ts">
/**
 * Politique de confidentialité publique.
 *
 * - Pas de middleware : la page doit être consultable sans compte
 *   (revue Facebook Login, boutiques d'applications, futurs visiteurs
 *   SEO). Le lien est également exposé depuis `/profile` pour les
 *   utilisateurs connectés.
 * - Layout `auth` : pas de BottomNav, ce qui éviterait d'exposer aux
 *   visiteurs anonymes des onglets qui exigent une session. Le bouton
 *   retour du TopBar suffit à la navigation intra-app.
 */
definePageMeta({
  layout: 'auth',
})

useHead({
  title: 'Politique de confidentialité — Kartiki',
  meta: [
    {
      name: 'description',
      content:
        'Politique de confidentialité de Kartiki : données collectées, finalités, partage, durée de conservation et exercice des droits RGPD.',
    },
    { name: 'robots', content: 'index, follow' },
  ],
})

const LAST_UPDATED = '20 avril 2026'
const CONTACT_EMAIL = 'contact@aito-flow.com'
</script>

<template>
  <div class="legal-stack">
    <TopBar title="Politique de confidentialité" show-back />

    <Card>
      <template #content>
        <p class="legal-updated tr-subtle">
          Dernière mise à jour : {{ LAST_UPDATED }}
        </p>
        <p>
          La présente politique décrit la manière dont
          <strong>Kartiki</strong> (ci-après « l'Application »)
          collecte, utilise et protège vos données personnelles
          lorsque vous utilisez notre service de covoiturage temps
          réel en Polynésie française.
        </p>
        <p>
          En créant un compte ou en utilisant l'Application, vous
          acceptez les traitements décrits ici. Si vous n'êtes pas
          d'accord avec cette politique, merci de ne pas utiliser
          Kartiki.
        </p>
      </template>
    </Card>

    <Card>
      <template #title>1. Responsable du traitement</template>
      <template #content>
        <p>
          Kartiki est exploité dans le cadre du projet
          <strong>Aito Flow</strong>. Pour toute question relative à
          vos données personnelles, vous pouvez nous contacter à
          l'adresse :
        </p>
        <p>
          <a :href="`mailto:${CONTACT_EMAIL}`" class="legal-link">
            {{ CONTACT_EMAIL }}
          </a>
        </p>
      </template>
    </Card>

    <Card>
      <template #title>2. Données collectées</template>
      <template #content>
        <p>Nous collectons uniquement ce qui est nécessaire au service :</p>

        <h3 class="legal-h3">Compte et profil</h3>
        <ul class="legal-list">
          <li>Adresse e-mail (identifiant de connexion)</li>
          <li>Mot de passe (stocké hashé, jamais en clair)</li>
          <li>Prénom, nom, numéro de téléphone (facultatif)</li>
          <li>Photo de profil (facultatif)</li>
          <li>
            Identifiant Facebook, si vous utilisez « Continuer avec
            Facebook » (permissions demandées : <em>email</em> et
            <em>public_profile</em> uniquement)
          </li>
        </ul>

        <h3 class="legal-h3">Conducteurs — documents d'identité</h3>
        <ul class="legal-list">
          <li>
            Photo de votre permis de conduire (recto). Les données
            extraites par OCR (nom, date de validité) sont
            comparées à votre profil pour valider votre
            certification.
          </li>
          <li>
            Photo de la vignette d'assurance de chaque véhicule
            (plaque et date de fin de validité visibles).
          </li>
        </ul>

        <h3 class="legal-h3">Véhicules</h3>
        <ul class="legal-list">
          <li>Plaque d'immatriculation, modèle, couleur</li>
          <li>Photo du véhicule (trois-quart face)</li>
        </ul>

        <h3 class="legal-h3">Données de localisation et trajets</h3>
        <ul class="legal-list">
          <li>
            Position GPS en temps réel pendant que vous êtes « en
            ligne » (conducteur) ou « en attente » (passager), afin
            que l'autre partie puisse vous repérer sur la carte.
          </li>
          <li>
            Position GPS pendant un trajet en cours (points loggés
            en continu, utilisés pour calculer la distance
            parcourue via Mapbox Map Matching).
          </li>
          <li>
            Direction choisie (ville ou campagne) et destinations
            favorites éventuellement configurées.
          </li>
          <li>
            Historique des trajets : départ, arrivée, distance,
            durée, tarif.
          </li>
        </ul>

        <h3 class="legal-h3">Portefeuille et paiements</h3>
        <ul class="legal-list">
          <li>
            Solde en francs pacifiques (XPF) et historique des
            transactions (débits passager / crédits conducteur).
          </li>
          <li>
            Demandes d'ajout de fonds et de virement, avec
            justificatif éventuel.
          </li>
        </ul>

        <h3 class="legal-h3">Données techniques</h3>
        <ul class="legal-list">
          <li>
            Adresse IP (journalisée côté hébergeur et Mapbox pour
            prévention de l'abus)
          </li>
          <li>
            Date et heure des requêtes API, en tant que métadonnées
            des journaux serveur et du journal d'audit administratif
          </li>
        </ul>
      </template>
    </Card>

    <Card>
      <template #title>3. Finalités du traitement</template>
      <template #content>
        <ul class="legal-list">
          <li>
            <strong>Fournir le service :</strong> mettre en relation
            passagers et conducteurs en temps réel, calculer les
            trajets, débiter / créditer les portefeuilles.
          </li>
          <li>
            <strong>Sécurité et conformité :</strong> vérifier que
            les conducteurs disposent d'un permis valide et d'une
            assurance en cours, lutter contre la fraude.
          </li>
          <li>
            <strong>Support :</strong> répondre à vos demandes
            d'assistance.
          </li>
          <li>
            <strong>Obligations légales :</strong> conservation des
            traces financières et de trajet pour les durées imposées
            par la réglementation applicable.
          </li>
        </ul>
      </template>
    </Card>

    <Card>
      <template #title>4. Base légale</template>
      <template #content>
        <ul class="legal-list">
          <li>
            <strong>Exécution du contrat</strong> (art. 6-1-b RGPD)
            pour la création et la gestion du compte, la mise en
            relation, le calcul et le règlement des trajets.
          </li>
          <li>
            <strong>Intérêt légitime</strong> (art. 6-1-f RGPD) pour
            la sécurité du service et la prévention des abus.
          </li>
          <li>
            <strong>Obligation légale</strong> (art. 6-1-c RGPD)
            pour la conservation des pièces financières et des
            documents de certification.
          </li>
          <li>
            <strong>Consentement</strong> (art. 6-1-a RGPD) pour le
            traitement de votre photo de profil facultative et le
            partage de votre position géographique, révocable à tout
            moment en désactivant le mode « en ligne » / « en
            attente » ou en supprimant votre compte.
          </li>
        </ul>
      </template>
    </Card>

    <Card>
      <template #title>5. Partage avec des tiers</template>
      <template #content>
        <p>
          Nous ne vendons jamais vos données. Nous les partageons
          uniquement avec les prestataires strictement nécessaires
          au fonctionnement de l'Application :
        </p>
        <ul class="legal-list">
          <li>
            <strong>Mapbox</strong> (États-Unis) — affichage de la
            carte et calcul de distance (Map Matching). Mapbox reçoit
            votre adresse IP et les coordonnées des points de vos
            trajets lors du calcul.
          </li>
          <li>
            <strong>OpenAI</strong> (États-Unis) — OCR automatique
            des photos de permis et de vignettes d'assurance
            (modèle <em>gpt-4o-mini</em>). Les images sont
            transmises uniquement au moment de l'upload pour en
            extraire les informations structurées ; elles ne sont
            pas utilisées par OpenAI pour entraîner ses modèles
            (politique API d'OpenAI).
          </li>
          <li>
            <strong>Facebook / Meta</strong> (États-Unis) —
            uniquement si vous choisissez « Continuer avec
            Facebook ». Nous recevons votre identifiant Facebook,
            votre e-mail et votre nom public.
          </li>
          <li>
            <strong>Hébergeur</strong> — serveur situé en France,
            qui stocke la base de données et les fichiers téléversés.
          </li>
        </ul>
        <p class="legal-note">
          Les transferts vers les États-Unis (Mapbox, OpenAI,
          Facebook) sont encadrés par les clauses contractuelles
          types de la Commission européenne ou le cadre
          <em>Data Privacy Framework</em> lorsque le prestataire y
          est certifié.
        </p>
      </template>
    </Card>

    <Card>
      <template #title>6. Durée de conservation</template>
      <template #content>
        <ul class="legal-list">
          <li>
            <strong>Compte actif :</strong> aussi longtemps que vous
            utilisez le service.
          </li>
          <li>
            <strong>Compte supprimé :</strong> le compte est marqué
            comme supprimé immédiatement ; les photos de permis, de
            vignettes et de profil, ainsi que les numéros de
            téléphone et les données Facebook, sont effacés sous 30
            jours.
          </li>
          <li>
            <strong>Historique des trajets et transactions :</strong>
            conservé de manière anonymisée (sans lien identifiable
            avec votre personne) pendant la durée imposée par les
            obligations comptables et fiscales applicables (jusqu'à
            10 ans).
          </li>
          <li>
            <strong>Journal d'audit administratif :</strong>
            immuable et conservé pour les besoins de sécurité et de
            lutte contre la fraude.
          </li>
        </ul>
      </template>
    </Card>

    <Card>
      <template #title>7. Vos droits</template>
      <template #content>
        <p>
          Conformément au RGPD et à la loi Informatique et Libertés,
          vous disposez des droits suivants :
        </p>
        <ul class="legal-list">
          <li>
            <strong>Accès</strong> : obtenir une copie de vos
            données.
          </li>
          <li>
            <strong>Rectification</strong> : corriger des
            informations inexactes (vous pouvez déjà modifier vos
            nom, prénom, téléphone et photo depuis la page
            <NuxtLink to="/profile" class="legal-link">Profil</NuxtLink>).
          </li>
          <li>
            <strong>Effacement</strong> : demander la suppression de
            votre compte — voir la page
            <NuxtLink to="/data-deletion" class="legal-link">
              Suppression des données
            </NuxtLink>.
          </li>
          <li>
            <strong>Portabilité</strong> : recevoir vos données
            dans un format structuré et lisible par machine.
          </li>
          <li>
            <strong>Opposition et limitation</strong> : restreindre
            certains traitements fondés sur l'intérêt légitime.
          </li>
          <li>
            <strong>Retrait du consentement</strong> à tout moment
            pour les traitements qui en dépendent.
          </li>
          <li>
            <strong>Réclamation</strong> auprès de la CNIL
            (<a
              href="https://www.cnil.fr"
              rel="noopener"
              target="_blank"
              class="legal-link"
            >
              www.cnil.fr
            </a>) si vous estimez que vos droits ne sont pas
            respectés.
          </li>
        </ul>
        <p>
          Pour exercer ces droits, écrivez-nous à
          <a :href="`mailto:${CONTACT_EMAIL}`" class="legal-link">
            {{ CONTACT_EMAIL }}
          </a>
          avec une pièce justificative d'identité si nécessaire.
          Nous répondons sous 30 jours.
        </p>
      </template>
    </Card>

    <Card>
      <template #title>8. Sécurité</template>
      <template #content>
        <ul class="legal-list">
          <li>
            Connexion HTTPS/TLS obligatoire entre votre appareil et
            nos serveurs.
          </li>
          <li>
            Mots de passe hashés côté serveur — jamais stockés en
            clair.
          </li>
          <li>
            Authentification par jeton JWT signé, à durée de vie
            limitée.
          </li>
          <li>
            Les documents sensibles (permis, vignette) ne sont
            accessibles qu'à leur propriétaire et aux administrateurs
            habilités.
          </li>
          <li>
            Chaque action administrative est tracée dans un journal
            d'audit immuable.
          </li>
        </ul>
      </template>
    </Card>

    <Card>
      <template #title>9. Cookies et stockage local</template>
      <template #content>
        <p>
          Kartiki n'utilise <strong>aucun cookie tiers</strong> ni
          outil de mesure d'audience. Nous stockons côté navigateur :
        </p>
        <ul class="legal-list">
          <li>
            Le jeton JWT de session (nécessaire à la connexion).
          </li>
          <li>
            Un cache local des pages visitées (Service Worker PWA,
            pour fonctionner hors connexion).
          </li>
          <li>
            Vos destinations favorites « Maison » et « Travail »
            configurées depuis le profil — stockées
            <strong>uniquement sur votre appareil</strong>, jamais
            envoyées au serveur.
          </li>
        </ul>
      </template>
    </Card>

    <Card>
      <template #title>10. Mineurs</template>
      <template #content>
        <p>
          L'Application est destinée aux personnes âgées de 16 ans
          ou plus. Pour le mode conducteur, un permis de conduire en
          cours de validité est requis (soit 18 ans minimum).
          Nous ne collectons pas sciemment de données concernant
          des mineurs de moins de 16 ans. Si vous êtes parent ou
          tuteur et pensez qu'un mineur nous a fourni des données,
          contactez-nous pour obtenir leur suppression immédiate.
        </p>
      </template>
    </Card>

    <Card>
      <template #title>11. Modifications</template>
      <template #content>
        <p>
          Nous pouvons mettre à jour cette politique pour refléter
          des évolutions techniques ou légales. La date de dernière
          mise à jour figure en haut de cette page. En cas de
          changement significatif, nous vous notifierons dans
          l'Application avant que la nouvelle version ne prenne
          effet.
        </p>
      </template>
    </Card>

    <Card>
      <template #title>12. Contact</template>
      <template #content>
        <p>
          Pour toute question concernant cette politique ou vos
          données personnelles :
        </p>
        <p>
          <a :href="`mailto:${CONTACT_EMAIL}`" class="legal-link">
            {{ CONTACT_EMAIL }}
          </a>
        </p>
        <div class="legal-cta">
          <NuxtLink to="/data-deletion" class="legal-cta-link">
            <Button
              label="Demander la suppression de mes données"
              icon="pi pi-trash"
              severity="secondary"
              size="small"
            />
          </NuxtLink>
        </div>
      </template>
    </Card>
  </div>
</template>

<style scoped>
.legal-stack {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
  max-width: 760px;
  margin: 0 auto;
}
.legal-updated {
  margin: 0 0 0.75rem;
  font-size: 0.85rem;
}
.legal-h3 {
  font-size: 1rem;
  margin: 1rem 0 0.35rem;
}
.legal-h3:first-of-type {
  margin-top: 0.5rem;
}
.legal-list {
  margin: 0.25rem 0 0.5rem;
  padding-left: 1.25rem;
  line-height: 1.55;
}
.legal-list li {
  margin-bottom: 0.35rem;
}
.legal-note {
  font-size: 0.85rem;
  color: var(--p-text-muted-color);
  margin-top: 0.5rem;
}
.legal-link {
  color: var(--p-primary-color);
  text-decoration: none;
}
.legal-link:hover {
  text-decoration: underline;
}
.legal-cta {
  margin-top: 0.75rem;
}
.legal-cta-link {
  text-decoration: none;
}
</style>
