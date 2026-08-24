export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          changed_fields: string[] | null
          created_at: string
          id: string
          new_values: Json | null
          old_values: Json | null
          record_id: string | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          changed_fields?: string[] | null
          created_at?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          changed_fields?: string[] | null
          created_at?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      baux: {
        Row: {
          assurance_compagnie: string | null
          assurance_date_expiration: string | null
          assurance_police: string | null
          avance_loyer: number
          bien_id: string
          caution: number
          caution_montant_initial: number | null
          caution_montant_restant: number | null
          cles_remises_le: string | null
          commission_agence: number
          created_at: string
          date_entree: string
          date_fin: string | null
          date_renouvellement_prevue: string | null
          etat_lieux_date: string | null
          etat_lieux_fait: boolean
          garant_piece_expiration: string | null
          id: string
          jour_echeance: number
          jour_penalite: number
          jour_tolerance: number
          locataire_id: string
          loyer_mensuel: number
          notes: string | null
          notes_renouvellement: string | null
          penalite_base: string
          reference: string | null
          statut: Database["public"]["Enums"]["bail_statut"]
          taux_penalite_journalier: number
          transfere_juridique_le: string | null
          transfert_juridique_propose: boolean
          updated_at: string
        }
        Insert: {
          assurance_compagnie?: string | null
          assurance_date_expiration?: string | null
          assurance_police?: string | null
          avance_loyer?: number
          bien_id: string
          caution: number
          caution_montant_initial?: number | null
          caution_montant_restant?: number | null
          cles_remises_le?: string | null
          commission_agence?: number
          created_at?: string
          date_entree: string
          date_fin?: string | null
          date_renouvellement_prevue?: string | null
          etat_lieux_date?: string | null
          etat_lieux_fait?: boolean
          garant_piece_expiration?: string | null
          id?: string
          jour_echeance?: number
          jour_penalite?: number
          jour_tolerance?: number
          locataire_id: string
          loyer_mensuel: number
          notes?: string | null
          notes_renouvellement?: string | null
          penalite_base?: string
          reference?: string | null
          statut?: Database["public"]["Enums"]["bail_statut"]
          taux_penalite_journalier?: number
          transfere_juridique_le?: string | null
          transfert_juridique_propose?: boolean
          updated_at?: string
        }
        Update: {
          assurance_compagnie?: string | null
          assurance_date_expiration?: string | null
          assurance_police?: string | null
          avance_loyer?: number
          bien_id?: string
          caution?: number
          caution_montant_initial?: number | null
          caution_montant_restant?: number | null
          cles_remises_le?: string | null
          commission_agence?: number
          created_at?: string
          date_entree?: string
          date_fin?: string | null
          date_renouvellement_prevue?: string | null
          etat_lieux_date?: string | null
          etat_lieux_fait?: boolean
          garant_piece_expiration?: string | null
          id?: string
          jour_echeance?: number
          jour_penalite?: number
          jour_tolerance?: number
          locataire_id?: string
          loyer_mensuel?: number
          notes?: string | null
          notes_renouvellement?: string | null
          penalite_base?: string
          reference?: string | null
          statut?: Database["public"]["Enums"]["bail_statut"]
          taux_penalite_journalier?: number
          transfere_juridique_le?: string | null
          transfert_juridique_propose?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "baux_bien_fk"
            columns: ["bien_id"]
            isOneToOne: false
            referencedRelation: "biens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "baux_bien_id_fkey"
            columns: ["bien_id"]
            isOneToOne: false
            referencedRelation: "biens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "baux_locataire_fk"
            columns: ["locataire_id"]
            isOneToOne: false
            referencedRelation: "locataires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "baux_locataire_fk"
            columns: ["locataire_id"]
            isOneToOne: false
            referencedRelation: "v_locataire_360"
            referencedColumns: ["locataire_id"]
          },
          {
            foreignKeyName: "baux_locataire_fk"
            columns: ["locataire_id"]
            isOneToOne: false
            referencedRelation: "v_locataires_classification"
            referencedColumns: ["locataire_id"]
          },
          {
            foreignKeyName: "baux_locataire_id_fkey"
            columns: ["locataire_id"]
            isOneToOne: false
            referencedRelation: "locataires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "baux_locataire_id_fkey"
            columns: ["locataire_id"]
            isOneToOne: false
            referencedRelation: "v_locataire_360"
            referencedColumns: ["locataire_id"]
          },
          {
            foreignKeyName: "baux_locataire_id_fkey"
            columns: ["locataire_id"]
            isOneToOne: false
            referencedRelation: "v_locataires_classification"
            referencedColumns: ["locataire_id"]
          },
        ]
      }
      biens: {
        Row: {
          adresse: string | null
          charges: number
          commune: string | null
          created_at: string
          id: string
          loyer_mensuel: number
          pieces: number | null
          proprietaire_id: string
          quartier: string | null
          reference: string | null
          statut: Database["public"]["Enums"]["bien_statut"]
          type: string
          updated_at: string
        }
        Insert: {
          adresse?: string | null
          charges?: number
          commune?: string | null
          created_at?: string
          id?: string
          loyer_mensuel: number
          pieces?: number | null
          proprietaire_id: string
          quartier?: string | null
          reference?: string | null
          statut?: Database["public"]["Enums"]["bien_statut"]
          type: string
          updated_at?: string
        }
        Update: {
          adresse?: string | null
          charges?: number
          commune?: string | null
          created_at?: string
          id?: string
          loyer_mensuel?: number
          pieces?: number | null
          proprietaire_id?: string
          quartier?: string | null
          reference?: string | null
          statut?: Database["public"]["Enums"]["bien_statut"]
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "biens_proprietaire_fk"
            columns: ["proprietaire_id"]
            isOneToOne: false
            referencedRelation: "proprietaires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "biens_proprietaire_fk"
            columns: ["proprietaire_id"]
            isOneToOne: false
            referencedRelation: "v_proprietaire_360"
            referencedColumns: ["proprietaire_id"]
          },
          {
            foreignKeyName: "biens_proprietaire_id_fkey"
            columns: ["proprietaire_id"]
            isOneToOne: false
            referencedRelation: "proprietaires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "biens_proprietaire_id_fkey"
            columns: ["proprietaire_id"]
            isOneToOne: false
            referencedRelation: "v_proprietaire_360"
            referencedColumns: ["proprietaire_id"]
          },
        ]
      }
      candidatures: {
        Row: {
          bien_id: string
          created_at: string
          decision_motif: string | null
          employeur: string | null
          garant_nom: string | null
          garant_telephone: string | null
          id: string
          pieces_jointes: Json
          prospect_id: string
          revenus_mensuels: number | null
          statut: Database["public"]["Enums"]["candidature_statut"]
          updated_at: string
          validee_le: string | null
          validee_par: string | null
        }
        Insert: {
          bien_id: string
          created_at?: string
          decision_motif?: string | null
          employeur?: string | null
          garant_nom?: string | null
          garant_telephone?: string | null
          id?: string
          pieces_jointes?: Json
          prospect_id: string
          revenus_mensuels?: number | null
          statut?: Database["public"]["Enums"]["candidature_statut"]
          updated_at?: string
          validee_le?: string | null
          validee_par?: string | null
        }
        Update: {
          bien_id?: string
          created_at?: string
          decision_motif?: string | null
          employeur?: string | null
          garant_nom?: string | null
          garant_telephone?: string | null
          id?: string
          pieces_jointes?: Json
          prospect_id?: string
          revenus_mensuels?: number | null
          statut?: Database["public"]["Enums"]["candidature_statut"]
          updated_at?: string
          validee_le?: string | null
          validee_par?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidatures_bien_fk"
            columns: ["bien_id"]
            isOneToOne: false
            referencedRelation: "biens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidatures_bien_id_fkey"
            columns: ["bien_id"]
            isOneToOne: false
            referencedRelation: "biens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidatures_prospect_fk"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidatures_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      courriers_juridiques: {
        Row: {
          bail_id: string | null
          categorie: Database["public"]["Enums"]["courrier_categorie"]
          contenu_html: string
          created_at: string
          cree_par: string | null
          date_envoi: string | null
          date_reception: string | null
          destinataire_adresse: string | null
          destinataire_nom: string | null
          fichier_docx_url: string | null
          fichier_pdf_url: string | null
          id: string
          locataire_id: string | null
          mode_envoi: string | null
          modele_id: string | null
          notes: string | null
          numero: string
          objet: string
          procedure_id: string | null
          reference_envoi: string | null
          statut: Database["public"]["Enums"]["courrier_statut"]
          updated_at: string
        }
        Insert: {
          bail_id?: string | null
          categorie: Database["public"]["Enums"]["courrier_categorie"]
          contenu_html: string
          created_at?: string
          cree_par?: string | null
          date_envoi?: string | null
          date_reception?: string | null
          destinataire_adresse?: string | null
          destinataire_nom?: string | null
          fichier_docx_url?: string | null
          fichier_pdf_url?: string | null
          id?: string
          locataire_id?: string | null
          mode_envoi?: string | null
          modele_id?: string | null
          notes?: string | null
          numero: string
          objet: string
          procedure_id?: string | null
          reference_envoi?: string | null
          statut?: Database["public"]["Enums"]["courrier_statut"]
          updated_at?: string
        }
        Update: {
          bail_id?: string | null
          categorie?: Database["public"]["Enums"]["courrier_categorie"]
          contenu_html?: string
          created_at?: string
          cree_par?: string | null
          date_envoi?: string | null
          date_reception?: string | null
          destinataire_adresse?: string | null
          destinataire_nom?: string | null
          fichier_docx_url?: string | null
          fichier_pdf_url?: string | null
          id?: string
          locataire_id?: string | null
          mode_envoi?: string | null
          modele_id?: string | null
          notes?: string | null
          numero?: string
          objet?: string
          procedure_id?: string | null
          reference_envoi?: string | null
          statut?: Database["public"]["Enums"]["courrier_statut"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courriers_jur_bail_fk"
            columns: ["bail_id"]
            isOneToOne: false
            referencedRelation: "baux"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courriers_jur_bail_fk"
            columns: ["bail_id"]
            isOneToOne: false
            referencedRelation: "v_locataires_classification"
            referencedColumns: ["bail_id"]
          },
          {
            foreignKeyName: "courriers_jur_bail_fk"
            columns: ["bail_id"]
            isOneToOne: false
            referencedRelation: "v_loyers_retard"
            referencedColumns: ["bail_id"]
          },
          {
            foreignKeyName: "courriers_jur_locataire_fk"
            columns: ["locataire_id"]
            isOneToOne: false
            referencedRelation: "locataires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courriers_jur_locataire_fk"
            columns: ["locataire_id"]
            isOneToOne: false
            referencedRelation: "v_locataire_360"
            referencedColumns: ["locataire_id"]
          },
          {
            foreignKeyName: "courriers_jur_locataire_fk"
            columns: ["locataire_id"]
            isOneToOne: false
            referencedRelation: "v_locataires_classification"
            referencedColumns: ["locataire_id"]
          },
        ]
      }
      courriers_recus: {
        Row: {
          affecte_a: string | null
          bail_id: string | null
          categorie: Database["public"]["Enums"]["courrier_recu_categorie"]
          contenu: string | null
          created_at: string
          cree_par: string | null
          date_effet: string | null
          date_reception: string
          fichier_url: string | null
          id: string
          locataire_id: string | null
          modele_reponse_id: string | null
          notes: string | null
          objet: string
          redaction_html: string | null
          redige_par: string | null
          reponse_courrier_id: string | null
          statut: Database["public"]["Enums"]["courrier_recu_statut"]
          updated_at: string
          valide_le: string | null
          valide_par: string | null
        }
        Insert: {
          affecte_a?: string | null
          bail_id?: string | null
          categorie: Database["public"]["Enums"]["courrier_recu_categorie"]
          contenu?: string | null
          created_at?: string
          cree_par?: string | null
          date_effet?: string | null
          date_reception?: string
          fichier_url?: string | null
          id?: string
          locataire_id?: string | null
          modele_reponse_id?: string | null
          notes?: string | null
          objet: string
          redaction_html?: string | null
          redige_par?: string | null
          reponse_courrier_id?: string | null
          statut?: Database["public"]["Enums"]["courrier_recu_statut"]
          updated_at?: string
          valide_le?: string | null
          valide_par?: string | null
        }
        Update: {
          affecte_a?: string | null
          bail_id?: string | null
          categorie?: Database["public"]["Enums"]["courrier_recu_categorie"]
          contenu?: string | null
          created_at?: string
          cree_par?: string | null
          date_effet?: string | null
          date_reception?: string
          fichier_url?: string | null
          id?: string
          locataire_id?: string | null
          modele_reponse_id?: string | null
          notes?: string | null
          objet?: string
          redaction_html?: string | null
          redige_par?: string | null
          reponse_courrier_id?: string | null
          statut?: Database["public"]["Enums"]["courrier_recu_statut"]
          updated_at?: string
          valide_le?: string | null
          valide_par?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courriers_recus_bail_fk"
            columns: ["bail_id"]
            isOneToOne: false
            referencedRelation: "baux"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courriers_recus_bail_fk"
            columns: ["bail_id"]
            isOneToOne: false
            referencedRelation: "v_locataires_classification"
            referencedColumns: ["bail_id"]
          },
          {
            foreignKeyName: "courriers_recus_bail_fk"
            columns: ["bail_id"]
            isOneToOne: false
            referencedRelation: "v_loyers_retard"
            referencedColumns: ["bail_id"]
          },
          {
            foreignKeyName: "courriers_recus_locataire_fk"
            columns: ["locataire_id"]
            isOneToOne: false
            referencedRelation: "locataires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courriers_recus_locataire_fk"
            columns: ["locataire_id"]
            isOneToOne: false
            referencedRelation: "v_locataire_360"
            referencedColumns: ["locataire_id"]
          },
          {
            foreignKeyName: "courriers_recus_locataire_fk"
            columns: ["locataire_id"]
            isOneToOne: false
            referencedRelation: "v_locataires_classification"
            referencedColumns: ["locataire_id"]
          },
        ]
      }
      documents_locataire: {
        Row: {
          bail_id: string
          created_at: string
          date_emission: string | null
          date_expiration: string | null
          fichier_url: string | null
          id: string
          libelle: string
          locataire_id: string
          notes: string | null
          statut: Database["public"]["Enums"]["document_statut"]
          type: Database["public"]["Enums"]["document_type"]
          updated_at: string
        }
        Insert: {
          bail_id: string
          created_at?: string
          date_emission?: string | null
          date_expiration?: string | null
          fichier_url?: string | null
          id?: string
          libelle: string
          locataire_id: string
          notes?: string | null
          statut?: Database["public"]["Enums"]["document_statut"]
          type: Database["public"]["Enums"]["document_type"]
          updated_at?: string
        }
        Update: {
          bail_id?: string
          created_at?: string
          date_emission?: string | null
          date_expiration?: string | null
          fichier_url?: string | null
          id?: string
          libelle?: string
          locataire_id?: string
          notes?: string | null
          statut?: Database["public"]["Enums"]["document_statut"]
          type?: Database["public"]["Enums"]["document_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_bail_fk"
            columns: ["bail_id"]
            isOneToOne: false
            referencedRelation: "baux"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_bail_fk"
            columns: ["bail_id"]
            isOneToOne: false
            referencedRelation: "v_locataires_classification"
            referencedColumns: ["bail_id"]
          },
          {
            foreignKeyName: "documents_bail_fk"
            columns: ["bail_id"]
            isOneToOne: false
            referencedRelation: "v_loyers_retard"
            referencedColumns: ["bail_id"]
          },
          {
            foreignKeyName: "documents_locataire_fk"
            columns: ["locataire_id"]
            isOneToOne: false
            referencedRelation: "locataires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_locataire_fk"
            columns: ["locataire_id"]
            isOneToOne: false
            referencedRelation: "v_locataire_360"
            referencedColumns: ["locataire_id"]
          },
          {
            foreignKeyName: "documents_locataire_fk"
            columns: ["locataire_id"]
            isOneToOne: false
            referencedRelation: "v_locataires_classification"
            referencedColumns: ["locataire_id"]
          },
        ]
      }
      factures_entree: {
        Row: {
          avance_loyer: number
          bail_id: string | null
          bien_id: string
          candidature_id: string | null
          caution: number
          commission_agence: number
          created_at: string
          date_emission: string
          date_paiement: string | null
          id: string
          loyer_mensuel: number
          notes: string | null
          numero: string
          prospect_id: string | null
          statut: Database["public"]["Enums"]["facture_entree_statut"]
          total: number
          updated_at: string
        }
        Insert: {
          avance_loyer?: number
          bail_id?: string | null
          bien_id: string
          candidature_id?: string | null
          caution?: number
          commission_agence?: number
          created_at?: string
          date_emission?: string
          date_paiement?: string | null
          id?: string
          loyer_mensuel: number
          notes?: string | null
          numero: string
          prospect_id?: string | null
          statut?: Database["public"]["Enums"]["facture_entree_statut"]
          total: number
          updated_at?: string
        }
        Update: {
          avance_loyer?: number
          bail_id?: string | null
          bien_id?: string
          candidature_id?: string | null
          caution?: number
          commission_agence?: number
          created_at?: string
          date_emission?: string
          date_paiement?: string | null
          id?: string
          loyer_mensuel?: number
          notes?: string | null
          numero?: string
          prospect_id?: string | null
          statut?: Database["public"]["Enums"]["facture_entree_statut"]
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "factures_bail_fk"
            columns: ["bail_id"]
            isOneToOne: false
            referencedRelation: "baux"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factures_bail_fk"
            columns: ["bail_id"]
            isOneToOne: false
            referencedRelation: "v_locataires_classification"
            referencedColumns: ["bail_id"]
          },
          {
            foreignKeyName: "factures_bail_fk"
            columns: ["bail_id"]
            isOneToOne: false
            referencedRelation: "v_loyers_retard"
            referencedColumns: ["bail_id"]
          },
          {
            foreignKeyName: "factures_bien_fk"
            columns: ["bien_id"]
            isOneToOne: false
            referencedRelation: "biens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factures_entree_bail_id_fkey"
            columns: ["bail_id"]
            isOneToOne: false
            referencedRelation: "baux"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factures_entree_bail_id_fkey"
            columns: ["bail_id"]
            isOneToOne: false
            referencedRelation: "v_locataires_classification"
            referencedColumns: ["bail_id"]
          },
          {
            foreignKeyName: "factures_entree_bail_id_fkey"
            columns: ["bail_id"]
            isOneToOne: false
            referencedRelation: "v_loyers_retard"
            referencedColumns: ["bail_id"]
          },
          {
            foreignKeyName: "factures_entree_bien_id_fkey"
            columns: ["bien_id"]
            isOneToOne: false
            referencedRelation: "biens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factures_entree_candidature_id_fkey"
            columns: ["candidature_id"]
            isOneToOne: false
            referencedRelation: "candidatures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factures_entree_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      field_permissions: {
        Row: {
          created_at: string
          editable: boolean
          field: string
          id: string
          module: string
          required: boolean
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          visible: boolean
        }
        Insert: {
          created_at?: string
          editable?: boolean
          field: string
          id?: string
          module: string
          required?: boolean
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          visible?: boolean
        }
        Update: {
          created_at?: string
          editable?: boolean
          field?: string
          id?: string
          module?: string
          required?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          visible?: boolean
        }
        Relationships: []
      }
      frais_juridiques: {
        Row: {
          bail_id: string
          created_at: string
          date_frais: string
          id: string
          imputable_locataire: boolean
          libelle: string
          montant: number
          notes: string | null
          paye: boolean
          procedure_id: string | null
          type: Database["public"]["Enums"]["frais_type"]
          updated_at: string
        }
        Insert: {
          bail_id: string
          created_at?: string
          date_frais?: string
          id?: string
          imputable_locataire?: boolean
          libelle: string
          montant: number
          notes?: string | null
          paye?: boolean
          procedure_id?: string | null
          type: Database["public"]["Enums"]["frais_type"]
          updated_at?: string
        }
        Update: {
          bail_id?: string
          created_at?: string
          date_frais?: string
          id?: string
          imputable_locataire?: boolean
          libelle?: string
          montant?: number
          notes?: string | null
          paye?: boolean
          procedure_id?: string | null
          type?: Database["public"]["Enums"]["frais_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "frais_bail_fk"
            columns: ["bail_id"]
            isOneToOne: false
            referencedRelation: "baux"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frais_bail_fk"
            columns: ["bail_id"]
            isOneToOne: false
            referencedRelation: "v_locataires_classification"
            referencedColumns: ["bail_id"]
          },
          {
            foreignKeyName: "frais_bail_fk"
            columns: ["bail_id"]
            isOneToOne: false
            referencedRelation: "v_loyers_retard"
            referencedColumns: ["bail_id"]
          },
          {
            foreignKeyName: "frais_juridiques_bail_id_fkey"
            columns: ["bail_id"]
            isOneToOne: false
            referencedRelation: "baux"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frais_juridiques_bail_id_fkey"
            columns: ["bail_id"]
            isOneToOne: false
            referencedRelation: "v_locataires_classification"
            referencedColumns: ["bail_id"]
          },
          {
            foreignKeyName: "frais_juridiques_bail_id_fkey"
            columns: ["bail_id"]
            isOneToOne: false
            referencedRelation: "v_loyers_retard"
            referencedColumns: ["bail_id"]
          },
          {
            foreignKeyName: "frais_juridiques_procedure_id_fkey"
            columns: ["procedure_id"]
            isOneToOne: false
            referencedRelation: "procedures"
            referencedColumns: ["id"]
          },
        ]
      }
      locataires: {
        Row: {
          created_at: string
          email: string | null
          employeur: string | null
          garant_email: string | null
          garant_employeur: string | null
          garant_piece_numero: string | null
          garant_prenom: string | null
          id: string
          nif: string | null
          nom: string
          numero_piece: string | null
          piece_date_expiration: string | null
          piece_identite: string | null
          prenom: string | null
          raison_sociale: string | null
          rccm: string | null
          reference: string | null
          revenus_mensuels: number | null
          telephone: string | null
          type_personne: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          employeur?: string | null
          garant_email?: string | null
          garant_employeur?: string | null
          garant_piece_numero?: string | null
          garant_prenom?: string | null
          id?: string
          nif?: string | null
          nom: string
          numero_piece?: string | null
          piece_date_expiration?: string | null
          piece_identite?: string | null
          prenom?: string | null
          raison_sociale?: string | null
          rccm?: string | null
          reference?: string | null
          revenus_mensuels?: number | null
          telephone?: string | null
          type_personne?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          employeur?: string | null
          garant_email?: string | null
          garant_employeur?: string | null
          garant_piece_numero?: string | null
          garant_prenom?: string | null
          id?: string
          nif?: string | null
          nom?: string
          numero_piece?: string | null
          piece_date_expiration?: string | null
          piece_identite?: string | null
          prenom?: string | null
          raison_sociale?: string | null
          rccm?: string | null
          reference?: string | null
          revenus_mensuels?: number | null
          telephone?: string | null
          type_personne?: string
          updated_at?: string
        }
        Relationships: []
      }
      mises_en_demeure: {
        Row: {
          bail_id: string
          created_at: string
          date_emission: string
          date_envoi: string | null
          date_reponse: string | null
          delai_jours: number
          id: string
          mode_envoi: string | null
          montant_du: number
          nb_mois_retard: number
          notes: string | null
          numero: string
          statut: Database["public"]["Enums"]["med_statut"]
          updated_at: string
        }
        Insert: {
          bail_id: string
          created_at?: string
          date_emission?: string
          date_envoi?: string | null
          date_reponse?: string | null
          delai_jours?: number
          id?: string
          mode_envoi?: string | null
          montant_du: number
          nb_mois_retard: number
          notes?: string | null
          numero: string
          statut?: Database["public"]["Enums"]["med_statut"]
          updated_at?: string
        }
        Update: {
          bail_id?: string
          created_at?: string
          date_emission?: string
          date_envoi?: string | null
          date_reponse?: string | null
          delai_jours?: number
          id?: string
          mode_envoi?: string | null
          montant_du?: number
          nb_mois_retard?: number
          notes?: string | null
          numero?: string
          statut?: Database["public"]["Enums"]["med_statut"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "med_bail_fk"
            columns: ["bail_id"]
            isOneToOne: false
            referencedRelation: "baux"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "med_bail_fk"
            columns: ["bail_id"]
            isOneToOne: false
            referencedRelation: "v_locataires_classification"
            referencedColumns: ["bail_id"]
          },
          {
            foreignKeyName: "med_bail_fk"
            columns: ["bail_id"]
            isOneToOne: false
            referencedRelation: "v_loyers_retard"
            referencedColumns: ["bail_id"]
          },
          {
            foreignKeyName: "mises_en_demeure_bail_id_fkey"
            columns: ["bail_id"]
            isOneToOne: false
            referencedRelation: "baux"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mises_en_demeure_bail_id_fkey"
            columns: ["bail_id"]
            isOneToOne: false
            referencedRelation: "v_locataires_classification"
            referencedColumns: ["bail_id"]
          },
          {
            foreignKeyName: "mises_en_demeure_bail_id_fkey"
            columns: ["bail_id"]
            isOneToOne: false
            referencedRelation: "v_loyers_retard"
            referencedColumns: ["bail_id"]
          },
        ]
      }
      modeles_courrier: {
        Row: {
          actif: boolean
          categorie: Database["public"]["Enums"]["courrier_categorie"]
          contenu_html: string
          created_at: string
          id: string
          nom: string
          objet: string | null
          systeme: boolean
          updated_at: string
          variables: string[]
        }
        Insert: {
          actif?: boolean
          categorie: Database["public"]["Enums"]["courrier_categorie"]
          contenu_html: string
          created_at?: string
          id?: string
          nom: string
          objet?: string | null
          systeme?: boolean
          updated_at?: string
          variables?: string[]
        }
        Update: {
          actif?: boolean
          categorie?: Database["public"]["Enums"]["courrier_categorie"]
          contenu_html?: string
          created_at?: string
          id?: string
          nom?: string
          objet?: string | null
          systeme?: boolean
          updated_at?: string
          variables?: string[]
        }
        Relationships: []
      }
      modeles_relance: {
        Row: {
          actif: boolean
          canal: Database["public"]["Enums"]["canal_relance"]
          contenu: string
          created_at: string
          id: string
          jour_declenchement: number
          nom: string
          ordre: number
          sujet: string | null
          updated_at: string
        }
        Insert: {
          actif?: boolean
          canal: Database["public"]["Enums"]["canal_relance"]
          contenu: string
          created_at?: string
          id?: string
          jour_declenchement?: number
          nom: string
          ordre?: number
          sujet?: string | null
          updated_at?: string
        }
        Update: {
          actif?: boolean
          canal?: Database["public"]["Enums"]["canal_relance"]
          contenu?: string
          created_at?: string
          id?: string
          jour_declenchement?: number
          nom?: string
          ordre?: number
          sujet?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      paiements: {
        Row: {
          bail_id: string
          created_at: string
          date_paiement: string
          encaisse_par: string | null
          id: string
          mode: Database["public"]["Enums"]["mode_paiement"]
          mois_concerne: string
          montant: number
          notes: string | null
          numero_quittance: string
          reference_externe: string | null
        }
        Insert: {
          bail_id: string
          created_at?: string
          date_paiement?: string
          encaisse_par?: string | null
          id?: string
          mode: Database["public"]["Enums"]["mode_paiement"]
          mois_concerne: string
          montant: number
          notes?: string | null
          numero_quittance: string
          reference_externe?: string | null
        }
        Update: {
          bail_id?: string
          created_at?: string
          date_paiement?: string
          encaisse_par?: string | null
          id?: string
          mode?: Database["public"]["Enums"]["mode_paiement"]
          mois_concerne?: string
          montant?: number
          notes?: string | null
          numero_quittance?: string
          reference_externe?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "paiements_bail_fk"
            columns: ["bail_id"]
            isOneToOne: false
            referencedRelation: "baux"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paiements_bail_fk"
            columns: ["bail_id"]
            isOneToOne: false
            referencedRelation: "v_locataires_classification"
            referencedColumns: ["bail_id"]
          },
          {
            foreignKeyName: "paiements_bail_fk"
            columns: ["bail_id"]
            isOneToOne: false
            referencedRelation: "v_loyers_retard"
            referencedColumns: ["bail_id"]
          },
          {
            foreignKeyName: "paiements_bail_id_fkey"
            columns: ["bail_id"]
            isOneToOne: false
            referencedRelation: "baux"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paiements_bail_id_fkey"
            columns: ["bail_id"]
            isOneToOne: false
            referencedRelation: "v_locataires_classification"
            referencedColumns: ["bail_id"]
          },
          {
            foreignKeyName: "paiements_bail_id_fkey"
            columns: ["bail_id"]
            isOneToOne: false
            referencedRelation: "v_loyers_retard"
            referencedColumns: ["bail_id"]
          },
        ]
      }
      pieces_locataire: {
        Row: {
          created_at: string
          cree_par: string | null
          date_emission: string | null
          date_expiration: string | null
          fichier_url: string
          id: string
          libelle: string
          locataire_id: string
          notes: string | null
          type_document: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          cree_par?: string | null
          date_emission?: string | null
          date_expiration?: string | null
          fichier_url: string
          id?: string
          libelle: string
          locataire_id: string
          notes?: string | null
          type_document: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          cree_par?: string | null
          date_emission?: string | null
          date_expiration?: string | null
          fichier_url?: string
          id?: string
          libelle?: string
          locataire_id?: string
          notes?: string | null
          type_document?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pieces_locataire_fk"
            columns: ["locataire_id"]
            isOneToOne: false
            referencedRelation: "locataires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pieces_locataire_fk"
            columns: ["locataire_id"]
            isOneToOne: false
            referencedRelation: "v_locataire_360"
            referencedColumns: ["locataire_id"]
          },
          {
            foreignKeyName: "pieces_locataire_fk"
            columns: ["locataire_id"]
            isOneToOne: false
            referencedRelation: "v_locataires_classification"
            referencedColumns: ["locataire_id"]
          },
          {
            foreignKeyName: "pieces_locataire_locataire_id_fkey"
            columns: ["locataire_id"]
            isOneToOne: false
            referencedRelation: "locataires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pieces_locataire_locataire_id_fkey"
            columns: ["locataire_id"]
            isOneToOne: false
            referencedRelation: "v_locataire_360"
            referencedColumns: ["locataire_id"]
          },
          {
            foreignKeyName: "pieces_locataire_locataire_id_fkey"
            columns: ["locataire_id"]
            isOneToOne: false
            referencedRelation: "v_locataires_classification"
            referencedColumns: ["locataire_id"]
          },
        ]
      }
      procedures: {
        Row: {
          avocat: string | null
          bail_id: string
          created_at: string
          date_audience: string | null
          date_cloture: string | null
          date_debut: string
          huissier: string | null
          id: string
          juridiction: string | null
          med_id: string | null
          notes: string | null
          reference_dossier: string | null
          statut: Database["public"]["Enums"]["procedure_statut"]
          type: Database["public"]["Enums"]["procedure_type"]
          updated_at: string
        }
        Insert: {
          avocat?: string | null
          bail_id: string
          created_at?: string
          date_audience?: string | null
          date_cloture?: string | null
          date_debut?: string
          huissier?: string | null
          id?: string
          juridiction?: string | null
          med_id?: string | null
          notes?: string | null
          reference_dossier?: string | null
          statut?: Database["public"]["Enums"]["procedure_statut"]
          type: Database["public"]["Enums"]["procedure_type"]
          updated_at?: string
        }
        Update: {
          avocat?: string | null
          bail_id?: string
          created_at?: string
          date_audience?: string | null
          date_cloture?: string | null
          date_debut?: string
          huissier?: string | null
          id?: string
          juridiction?: string | null
          med_id?: string | null
          notes?: string | null
          reference_dossier?: string | null
          statut?: Database["public"]["Enums"]["procedure_statut"]
          type?: Database["public"]["Enums"]["procedure_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "procedures_bail_fk"
            columns: ["bail_id"]
            isOneToOne: false
            referencedRelation: "baux"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procedures_bail_fk"
            columns: ["bail_id"]
            isOneToOne: false
            referencedRelation: "v_locataires_classification"
            referencedColumns: ["bail_id"]
          },
          {
            foreignKeyName: "procedures_bail_fk"
            columns: ["bail_id"]
            isOneToOne: false
            referencedRelation: "v_loyers_retard"
            referencedColumns: ["bail_id"]
          },
          {
            foreignKeyName: "procedures_bail_id_fkey"
            columns: ["bail_id"]
            isOneToOne: false
            referencedRelation: "baux"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procedures_bail_id_fkey"
            columns: ["bail_id"]
            isOneToOne: false
            referencedRelation: "v_locataires_classification"
            referencedColumns: ["bail_id"]
          },
          {
            foreignKeyName: "procedures_bail_id_fkey"
            columns: ["bail_id"]
            isOneToOne: false
            referencedRelation: "v_loyers_retard"
            referencedColumns: ["bail_id"]
          },
          {
            foreignKeyName: "procedures_med_id_fkey"
            columns: ["med_id"]
            isOneToOne: false
            referencedRelation: "mises_en_demeure"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          nom: string | null
          prenom: string | null
          telephone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          nom?: string | null
          prenom?: string | null
          telephone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          nom?: string | null
          prenom?: string | null
          telephone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      proprietaires: {
        Row: {
          adresse: string | null
          created_at: string
          email: string | null
          id: string
          nom: string
          numero_gestion: string | null
          rib: string | null
          taux_honoraires: number
          telephone: string | null
          type_personne: string
          updated_at: string
        }
        Insert: {
          adresse?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nom: string
          numero_gestion?: string | null
          rib?: string | null
          taux_honoraires?: number
          telephone?: string | null
          type_personne?: string
          updated_at?: string
        }
        Update: {
          adresse?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nom?: string
          numero_gestion?: string | null
          rib?: string | null
          taux_honoraires?: number
          telephone?: string | null
          type_personne?: string
          updated_at?: string
        }
        Relationships: []
      }
      prospects: {
        Row: {
          assigne_a: string | null
          budget_max: number | null
          commune_recherche: string | null
          created_at: string
          email: string | null
          id: string
          nom: string
          notes: string | null
          prenom: string | null
          source: string | null
          statut: Database["public"]["Enums"]["prospect_statut"]
          telephone: string | null
          type_recherche: string | null
          updated_at: string
        }
        Insert: {
          assigne_a?: string | null
          budget_max?: number | null
          commune_recherche?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nom: string
          notes?: string | null
          prenom?: string | null
          source?: string | null
          statut?: Database["public"]["Enums"]["prospect_statut"]
          telephone?: string | null
          type_recherche?: string | null
          updated_at?: string
        }
        Update: {
          assigne_a?: string | null
          budget_max?: number | null
          commune_recherche?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nom?: string
          notes?: string | null
          prenom?: string | null
          source?: string | null
          statut?: Database["public"]["Enums"]["prospect_statut"]
          telephone?: string | null
          type_recherche?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      relances_envoyees: {
        Row: {
          bail_id: string
          canal: Database["public"]["Enums"]["canal_relance"]
          contenu_envoye: string
          created_at: string
          date_envoi: string
          destinataire: string
          envoye_par: string | null
          erreur: string | null
          id: string
          modele_id: string | null
          reference_externe: string | null
          statut: Database["public"]["Enums"]["relance_statut"]
        }
        Insert: {
          bail_id: string
          canal: Database["public"]["Enums"]["canal_relance"]
          contenu_envoye: string
          created_at?: string
          date_envoi?: string
          destinataire: string
          envoye_par?: string | null
          erreur?: string | null
          id?: string
          modele_id?: string | null
          reference_externe?: string | null
          statut?: Database["public"]["Enums"]["relance_statut"]
        }
        Update: {
          bail_id?: string
          canal?: Database["public"]["Enums"]["canal_relance"]
          contenu_envoye?: string
          created_at?: string
          date_envoi?: string
          destinataire?: string
          envoye_par?: string | null
          erreur?: string | null
          id?: string
          modele_id?: string | null
          reference_externe?: string | null
          statut?: Database["public"]["Enums"]["relance_statut"]
        }
        Relationships: [
          {
            foreignKeyName: "relances_bail_fk"
            columns: ["bail_id"]
            isOneToOne: false
            referencedRelation: "baux"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relances_bail_fk"
            columns: ["bail_id"]
            isOneToOne: false
            referencedRelation: "v_locataires_classification"
            referencedColumns: ["bail_id"]
          },
          {
            foreignKeyName: "relances_bail_fk"
            columns: ["bail_id"]
            isOneToOne: false
            referencedRelation: "v_loyers_retard"
            referencedColumns: ["bail_id"]
          },
          {
            foreignKeyName: "relances_envoyees_bail_id_fkey"
            columns: ["bail_id"]
            isOneToOne: false
            referencedRelation: "baux"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relances_envoyees_bail_id_fkey"
            columns: ["bail_id"]
            isOneToOne: false
            referencedRelation: "v_locataires_classification"
            referencedColumns: ["bail_id"]
          },
          {
            foreignKeyName: "relances_envoyees_bail_id_fkey"
            columns: ["bail_id"]
            isOneToOne: false
            referencedRelation: "v_loyers_retard"
            referencedColumns: ["bail_id"]
          },
          {
            foreignKeyName: "relances_envoyees_modele_id_fkey"
            columns: ["modele_id"]
            isOneToOne: false
            referencedRelation: "modeles_relance"
            referencedColumns: ["id"]
          },
        ]
      }
      reversements: {
        Row: {
          charges_deduites: number
          created_at: string
          date_paiement: string | null
          honoraires: number
          id: string
          mode_paiement: string | null
          mois_concerne: string
          net_a_reverser: number
          notes: string | null
          proprietaire_id: string
          reference_externe: string | null
          statut: Database["public"]["Enums"]["reversement_statut"]
          total_encaisse: number
          updated_at: string
        }
        Insert: {
          charges_deduites?: number
          created_at?: string
          date_paiement?: string | null
          honoraires?: number
          id?: string
          mode_paiement?: string | null
          mois_concerne: string
          net_a_reverser?: number
          notes?: string | null
          proprietaire_id: string
          reference_externe?: string | null
          statut?: Database["public"]["Enums"]["reversement_statut"]
          total_encaisse?: number
          updated_at?: string
        }
        Update: {
          charges_deduites?: number
          created_at?: string
          date_paiement?: string | null
          honoraires?: number
          id?: string
          mode_paiement?: string | null
          mois_concerne?: string
          net_a_reverser?: number
          notes?: string | null
          proprietaire_id?: string
          reference_externe?: string | null
          statut?: Database["public"]["Enums"]["reversement_statut"]
          total_encaisse?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reversements_proprietaire_fk"
            columns: ["proprietaire_id"]
            isOneToOne: false
            referencedRelation: "proprietaires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reversements_proprietaire_fk"
            columns: ["proprietaire_id"]
            isOneToOne: false
            referencedRelation: "v_proprietaire_360"
            referencedColumns: ["proprietaire_id"]
          },
          {
            foreignKeyName: "reversements_proprietaire_id_fkey"
            columns: ["proprietaire_id"]
            isOneToOne: false
            referencedRelation: "proprietaires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reversements_proprietaire_id_fkey"
            columns: ["proprietaire_id"]
            isOneToOne: false
            referencedRelation: "v_proprietaire_360"
            referencedColumns: ["proprietaire_id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          can_create: boolean
          can_delete: boolean
          can_edit: boolean
          can_view: boolean
          created_at: string
          id: string
          module: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          module: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          module?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      visites: {
        Row: {
          agent_id: string | null
          bien_id: string
          commentaire: string | null
          created_at: string
          date_visite: string
          id: string
          prospect_id: string
          statut: Database["public"]["Enums"]["visite_statut"]
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          bien_id: string
          commentaire?: string | null
          created_at?: string
          date_visite: string
          id?: string
          prospect_id: string
          statut?: Database["public"]["Enums"]["visite_statut"]
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          bien_id?: string
          commentaire?: string | null
          created_at?: string
          date_visite?: string
          id?: string
          prospect_id?: string
          statut?: Database["public"]["Enums"]["visite_statut"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "visites_bien_fk"
            columns: ["bien_id"]
            isOneToOne: false
            referencedRelation: "biens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visites_bien_id_fkey"
            columns: ["bien_id"]
            isOneToOne: false
            referencedRelation: "biens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visites_prospect_fk"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visites_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_locataire_360: {
        Row: {
          email: string | null
          locataire_id: string | null
          loyer_total_mensuel: number | null
          nb_baux: number | null
          nb_baux_actifs: number | null
          nom: string | null
          prenom: string | null
          raison_sociale: string | null
          reference: string | null
          telephone: string | null
          total_paye: number | null
          type_personne: string | null
        }
        Relationships: []
      }
      v_locataires_classification: {
        Row: {
          assurance_date_expiration: string | null
          bail_id: string | null
          bail_reference: string | null
          bail_statut: Database["public"]["Enums"]["bail_statut"] | null
          bien_adresse: string | null
          bien_commune: string | null
          bien_reference: string | null
          caution_montant_initial: number | null
          caution_montant_restant: number | null
          date_entree: string | null
          date_fin: string | null
          date_renouvellement_prevue: string | null
          email: string | null
          garant_piece_expiration: string | null
          locataire_id: string | null
          locataire_nom: string | null
          locataire_prenom: string | null
          loyer_mensuel: number | null
          nb_mois_ecoules: number | null
          piece_date_expiration: string | null
          pieces_a_renouveler: boolean | null
          solde_du: number | null
          statut_bail: string | null
          statut_paiement: string | null
          telephone: string | null
          total_du_theorique: number | null
          total_paye: number | null
        }
        Relationships: []
      }
      v_loyers_retard: {
        Row: {
          bail_id: string | null
          bien_id: string | null
          jour_echeance: number | null
          jour_penalite: number | null
          jour_tolerance: number | null
          jours_penalite_mois_courant: number | null
          locataire_id: string | null
          loyer_mensuel: number | null
          mois_retard: number | null
          penalite_base: string | null
          reference: string | null
          taux_penalite_journalier: number | null
          transfere_juridique_le: string | null
          transfert_juridique_propose: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "baux_bien_fk"
            columns: ["bien_id"]
            isOneToOne: false
            referencedRelation: "biens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "baux_bien_id_fkey"
            columns: ["bien_id"]
            isOneToOne: false
            referencedRelation: "biens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "baux_locataire_fk"
            columns: ["locataire_id"]
            isOneToOne: false
            referencedRelation: "locataires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "baux_locataire_fk"
            columns: ["locataire_id"]
            isOneToOne: false
            referencedRelation: "v_locataire_360"
            referencedColumns: ["locataire_id"]
          },
          {
            foreignKeyName: "baux_locataire_fk"
            columns: ["locataire_id"]
            isOneToOne: false
            referencedRelation: "v_locataires_classification"
            referencedColumns: ["locataire_id"]
          },
          {
            foreignKeyName: "baux_locataire_id_fkey"
            columns: ["locataire_id"]
            isOneToOne: false
            referencedRelation: "locataires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "baux_locataire_id_fkey"
            columns: ["locataire_id"]
            isOneToOne: false
            referencedRelation: "v_locataire_360"
            referencedColumns: ["locataire_id"]
          },
          {
            foreignKeyName: "baux_locataire_id_fkey"
            columns: ["locataire_id"]
            isOneToOne: false
            referencedRelation: "v_locataires_classification"
            referencedColumns: ["locataire_id"]
          },
        ]
      }
      v_proprietaire_360: {
        Row: {
          email: string | null
          nb_baux_actifs: number | null
          nb_biens: number | null
          nb_biens_loues: number | null
          nom: string | null
          numero_gestion: string | null
          proprietaire_id: string | null
          revenu_mensuel_brut: number | null
          taux_honoraires: number | null
          telephone: string | null
          total_reverse: number | null
          type_personne: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_users_with_roles: {
        Args: never
        Returns: {
          created_at: string
          id: string
          nom: string
          prenom: string
          roles: string[]
          telephone: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      transferer_au_juridique: {
        Args: { p_bail_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "direction"
        | "commercial"
        | "caisse"
        | "recouvrement"
        | "juridique"
      bail_statut: "actif" | "resilie" | "expire"
      bien_statut: "vacant" | "occupe" | "travaux"
      canal_relance: "sms" | "whatsapp" | "email"
      candidature_statut:
        | "en_etude"
        | "acceptee"
        | "refusee"
        | "convertie"
        | "validee_responsable"
      courrier_categorie:
        | "mise_en_demeure"
        | "sommation_payer"
        | "resiliation_bail"
        | "commandement_quitter"
        | "accuse_reception"
        | "relance_amiable"
        | "attestation_loyer"
        | "conge_proprietaire"
        | "courrier_huissier"
        | "courrier_avocat"
        | "autre"
        | "reponse_locataire"
      courrier_recu_categorie:
        | "preavis_depart"
        | "reclamation"
        | "demande_travaux"
        | "demande_information"
        | "contestation"
        | "autre"
      courrier_recu_statut:
        | "recu"
        | "en_traitement"
        | "reponse_envoyee"
        | "clos"
      courrier_statut: "brouillon" | "genere" | "envoye" | "recu" | "annule"
      document_statut: "valide" | "expirant" | "expire" | "manquant"
      document_type:
        | "bail"
        | "piece_identite"
        | "assurance"
        | "garant"
        | "caution"
        | "autre"
      facture_entree_statut: "brouillon" | "emise" | "payee" | "annulee"
      frais_type: "huissier" | "avocat" | "greffe" | "autre"
      med_statut:
        | "brouillon"
        | "envoyee"
        | "recue"
        | "sans_reponse"
        | "regularisee"
        | "escaladee"
      mode_paiement:
        | "especes"
        | "wave"
        | "orange_money"
        | "mtn_money"
        | "virement"
        | "cheque"
        | "mobile_money_om"
        | "mobile_money_moov"
        | "versement_bancaire"
      procedure_statut:
        | "en_cours"
        | "suspendue"
        | "close_favorable"
        | "close_defavorable"
      procedure_type:
        | "commandement"
        | "assignation"
        | "jugement"
        | "expulsion"
        | "autre"
      prospect_statut:
        | "nouveau"
        | "contacte"
        | "visite_planifiee"
        | "visite_effectuee"
        | "candidature"
        | "accepte"
        | "refuse"
        | "perdu"
      relance_statut: "preparee" | "envoyee" | "echec" | "lue"
      reversement_statut: "a_payer" | "paye" | "annule"
      visite_statut: "planifiee" | "effectuee" | "annulee" | "no_show"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "direction",
        "commercial",
        "caisse",
        "recouvrement",
        "juridique",
      ],
      bail_statut: ["actif", "resilie", "expire"],
      bien_statut: ["vacant", "occupe", "travaux"],
      canal_relance: ["sms", "whatsapp", "email"],
      candidature_statut: [
        "en_etude",
        "acceptee",
        "refusee",
        "convertie",
        "validee_responsable",
      ],
      courrier_categorie: [
        "mise_en_demeure",
        "sommation_payer",
        "resiliation_bail",
        "commandement_quitter",
        "accuse_reception",
        "relance_amiable",
        "attestation_loyer",
        "conge_proprietaire",
        "courrier_huissier",
        "courrier_avocat",
        "autre",
        "reponse_locataire",
      ],
      courrier_recu_categorie: [
        "preavis_depart",
        "reclamation",
        "demande_travaux",
        "demande_information",
        "contestation",
        "autre",
      ],
      courrier_recu_statut: [
        "recu",
        "en_traitement",
        "reponse_envoyee",
        "clos",
      ],
      courrier_statut: ["brouillon", "genere", "envoye", "recu", "annule"],
      document_statut: ["valide", "expirant", "expire", "manquant"],
      document_type: [
        "bail",
        "piece_identite",
        "assurance",
        "garant",
        "caution",
        "autre",
      ],
      facture_entree_statut: ["brouillon", "emise", "payee", "annulee"],
      frais_type: ["huissier", "avocat", "greffe", "autre"],
      med_statut: [
        "brouillon",
        "envoyee",
        "recue",
        "sans_reponse",
        "regularisee",
        "escaladee",
      ],
      mode_paiement: [
        "especes",
        "wave",
        "orange_money",
        "mtn_money",
        "virement",
        "cheque",
        "mobile_money_om",
        "mobile_money_moov",
        "versement_bancaire",
      ],
      procedure_statut: [
        "en_cours",
        "suspendue",
        "close_favorable",
        "close_defavorable",
      ],
      procedure_type: [
        "commandement",
        "assignation",
        "jugement",
        "expulsion",
        "autre",
      ],
      prospect_statut: [
        "nouveau",
        "contacte",
        "visite_planifiee",
        "visite_effectuee",
        "candidature",
        "accepte",
        "refuse",
        "perdu",
      ],
      relance_statut: ["preparee", "envoyee", "echec", "lue"],
      reversement_statut: ["a_payer", "paye", "annule"],
      visite_statut: ["planifiee", "effectuee", "annulee", "no_show"],
    },
  },
} as const
