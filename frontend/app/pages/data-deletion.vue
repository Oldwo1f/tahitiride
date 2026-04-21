<script setup lang="ts">
/**
 * Suppression des données utilisateurs — page publique.
 *
 * Exposée à la fois aux utilisateurs connectés (depuis /profile) et
 * aux visiteurs anonymes (revue Facebook Login, exigence de l'URL
 * « Data Deletion Instructions »). Pas de middleware : la page doit
 * rester lisible depuis n'importe quel contexte.
 */
definePageMeta({
  layout: 'auth',
})

useHead({
  title: 'Suppression des données — Kartiki',
  meta: [
    {
      name: 'description',
      content:
        "Comment demander la suppression de votre compte Kartiki et de vos données personnelles, ce qui est effacé et ce que nous devons conserver.",
    },
    { name: 'robots', content: 'index, follow' },
  ],
})

const CONTACT_EMAIL = 'contact@aito-flow.com'
const mailSubject = encodeURIComponent(
  'Suppression de compte Kartiki',
)
const mailBody = encodeURIComponent(
  `Bonjour,

Je souhaite la suppression de mon compte Kartiki et de mes données personnelles associées.

E-mail du compte : 
Motif (facultatif) : 

Merci de me confirmer la prise en compte de ma demande.`,
)
const mailto = computed(
  () =>
    `mailto:${CONTACT_EMAIL}?subject=${mailSubject}&body=${mailBody}`,
)
</script>

<template>
  <div class="legal-stack">
    <TopBar title="Suppression des données" show-back />

    <Card>
      <template #content>
        <p>
          Vous pouvez à tout moment demander la suppression de votre
          compte Kartiki et des données personnelles qui y sont
          rattachées. Cette page décrit la procédure, ce qui est
          effacé et ce que nous devons conserver pour respecter nos
          obligations légales.
        </p>
        <p class="tr-subtle">
          Pour comprendre le détail des données traitées, consultez
          également notre
          <NuxtLink to="/privacy" class="legal-link">
            politique de confidentialité
          </NuxtLink>.
        </p>
      </template>
    </Card>

    <Card>
      <template #title>1. Procédure</template>
      <template #content>
        <p>
          Envoyez une demande à l'adresse ci-dessous depuis l'e-mail
          associé à votre compte, en indiquant « Suppression de
          compte » en objet :
        </p>
        <p>
          <a :href="mailto" class="legal-link legal-mail">
            {{ CONTACT_EMAIL }}
          </a>
        </p>
        <p>
          Si votre compte a été créé via « Continuer avec
          Facebook », précisez-le : nous retrouverons votre compte à
          partir de l'e-mail Facebook associé.
        </p>
        <p class="legal-note">
          Si vous avez activé la connexion Facebook et supprimé
          l'application depuis vos paramètres Facebook, Meta nous
          notifie automatiquement. Nous traitons alors votre demande
          comme une suppression initiée par l'utilisateur, dans les
          mêmes délais.
        </p>
        <div class="legal-cta">
          <a :href="mailto" class="legal-cta-link">
            <Button
              label="Envoyer la demande par e-mail"
              icon="pi pi-envelope"
              severity="primary"
            />
          </a>
        </div>
      </template>
    </Card>

    <Card>
      <template #title>2. Ce qui est supprimé</template>
      <template #content>
        <p>
          Dès traitement de votre demande, votre compte est
          immédiatement désactivé et les éléments suivants sont
          effacés <strong>sous 30 jours</strong> :
        </p>
        <ul class="legal-list">
          <li>Votre adresse e-mail et votre mot de passe</li>
          <li>Votre nom, prénom, numéro de téléphone</li>
          <li>Votre photo de profil</li>
          <li>Vos photos de permis de conduire</li>
          <li>
            Vos photos de véhicules et de vignettes d'assurance
          </li>
          <li>
            Votre identifiant Facebook (si vous aviez utilisé la
            connexion Facebook)
          </li>
          <li>
            Vos préférences de destinations favorites (stockées
            localement sur votre appareil — elles disparaîtront en
            vidant le cache de l'application ou en la désinstallant)
          </li>
          <li>Vos points GPS temps réel des trajets actifs</li>
        </ul>
      </template>
    </Card>

    <Card>
      <template #title>3. Ce que nous devons conserver</template>
      <template #content>
        <p>
          Certaines données sont conservées de manière
          <strong>anonymisée</strong> (sans lien identifiable avec
          votre personne) afin de respecter nos obligations légales
          et comptables :
        </p>
        <ul class="legal-list">
          <li>
            <strong>Historique des trajets</strong> (distance,
            durée, tarif, date) — jusqu'à 10 ans pour la
            comptabilité.
          </li>
          <li>
            <strong>Historique du portefeuille</strong> (débits,
            crédits, demandes de virement) — jusqu'à 10 ans pour la
            conformité financière.
          </li>
          <li>
            <strong>Journal d'audit</strong> des actions
            administratives vous concernant — conservé pour des
            motifs de sécurité et de lutte contre la fraude.
          </li>
        </ul>
        <p class="legal-note">
          Après anonymisation, ces enregistrements ne permettent
          plus de vous identifier : votre nom, e-mail, téléphone et
          documents d'identité sont purgés des bases.
        </p>
      </template>
    </Card>

    <Card>
      <template #title>4. Délai de traitement</template>
      <template #content>
        <ul class="legal-list">
          <li>
            <strong>Désactivation du compte :</strong> sous 72
            heures après réception de la demande (vous ne pouvez
            plus vous connecter).
          </li>
          <li>
            <strong>Suppression effective des données
              personnelles :</strong> sous 30 jours.
          </li>
          <li>
            <strong>Confirmation par e-mail :</strong> nous vous
            envoyons un accusé de réception et une confirmation
            finale une fois la suppression terminée.
          </li>
        </ul>
      </template>
    </Card>

    <Card>
      <template #title>5. Questions ?</template>
      <template #content>
        <p>
          Pour toute question sur la suppression de vos données ou
          l'exercice de vos autres droits (accès, rectification,
          portabilité), écrivez-nous à
          <a :href="`mailto:${CONTACT_EMAIL}`" class="legal-link">
            {{ CONTACT_EMAIL }}
          </a>.
        </p>
        <p>
          Vous disposez également d'un droit de réclamation auprès
          de la CNIL (<a
            href="https://www.cnil.fr"
            rel="noopener"
            target="_blank"
            class="legal-link"
          >
            www.cnil.fr
          </a>).
        </p>
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
  overflow-wrap: anywhere;
}
.legal-link:hover {
  text-decoration: underline;
}
.legal-mail {
  font-weight: 600;
}
.legal-cta {
  margin-top: 0.75rem;
}
.legal-cta-link {
  text-decoration: none;
}
</style>
