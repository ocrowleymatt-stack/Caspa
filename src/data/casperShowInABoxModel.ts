export const casperShowInABoxModel = {
  "project_name": "Casper Show-in-a-Box with NemeSign Growth Engine",
  "version": "0.1",
  "objective": "Build a complete no-code production, licensing, music, marketing, ticketing, CRM and growth system for amateur theatre groups, schools and operatic societies.",
  "core_positioning": "Everything a group needs to create, license, promote, ticket, perform and report on a show in one box.",
  "primary_systems": {
    "casper_show_factory": {
      "purpose": "Create scripts, musical scores, soundtracks, arrangements, marketing packs, websites and licensed downloadable assets.",
      "role": "Creative production engine"
    },
    "nemesign_growth_engine": {
      "purpose": "Promote the Show-in-a-Box product to theatre groups and then run marketing, CRM, social, email, ticketing and reporting for each customer.",
      "role": "Sales, audience growth and campaign automation engine"
    }
  },
  "target_users": [
    "Amateur dramatic groups",
    "Operatic societies",
    "Schools",
    "Village hall theatre groups",
    "Community theatre groups",
    "Pantomime committees",
    "Small venues"
  ],
  "commercial_model": {
    "revenue_streams": [
      {
        "name": "Show pack licence",
        "description": "One-off licence for script, music, scores, marketing assets and performance rights.",
        "indicative_price_gbp": { "basic": 399, "standard": 699, "musical": 999, "premium": 1499 }
      },
      {
        "name": "NemeSign campaign subscription",
        "description": "Ongoing campaign, CRM, social, email, reporting and audience growth tools.",
        "indicative_monthly_price_gbp": { "basic": 49, "active_campaign": 149, "managed_growth": 499 }
      },
      {
        "name": "Ticketing fee",
        "description": "Native box office or connected ticketing revenue.",
        "pricing_options": { "per_ticket_fee_gbp": { "low": 0.25, "high": 0.5 }, "percentage_fee": { "low": 1, "high": 3 } }
      },
      {
        "name": "Customisation add-ons",
        "description": "Local jokes, star-role expansion, custom music key changes, topical update packs and bespoke marketing.",
        "indicative_price_gbp": { "low": 99, "mid": 299, "high": 750 }
      }
    ]
  },
  "system_modules": [
    {
      "module_id": "show_factory",
      "name": "Casper Show Factory",
      "priority": "P0",
      "description": "Main product engine that creates complete show packs.",
      "submodules": ["script_engine", "music_engine", "arrangement_engine", "soundtrack_engine", "licensing_engine", "asset_vault", "website_builder", "marketing_pack_builder", "customisation_engine", "rights_safety_gate"]
    },
    {
      "module_id": "nemesign_b2b_growth",
      "name": "NemeSign B2B Growth Engine",
      "priority": "P0",
      "description": "Promotes and sells Show-in-a-Box to theatre groups.",
      "submodules": ["lead_database", "cold_outreach", "email_sequences", "call_task_manager", "seo_campaign_manager", "paid_ads_manager", "crm_pipeline", "sales_reporting", "renewal_manager"]
    },
    {
      "module_id": "nemesign_customer_campaigns",
      "name": "NemeSign Customer Campaign Engine",
      "priority": "P0",
      "description": "Runs the buyer's own show marketing and customer engagement.",
      "submodules": ["audience_crm", "social_scheduler", "email_marketing", "ticket_sales_dashboard", "press_outreach", "sponsor_campaigns", "cast_marketing", "action_recommendations", "post_show_retention"]
    },
    {
      "module_id": "ticketing",
      "name": "Ticket Sales and Box Office",
      "priority": "P1",
      "description": "Native and external ticketing support.",
      "submodules": ["external_ticket_linking", "ticketing_embeds", "native_box_office", "qr_tickets", "door_check_in", "promo_codes", "comp_tickets", "sales_reports", "weak_night_promotions"]
    }
  ],
  "must_have_features": [
    {
      "feature_id": "script_generation",
      "description": "Generate musical and non-musical scripts.",
      "outputs": ["master_script_pdf", "master_script_docx", "editable_script", "prompt_script", "school_version", "adult_version", "family_version", "interactive_version", "cast_flex_version"],
      "priority": "P0"
    },
    {
      "feature_id": "music_generation",
      "description": "Create songs, lyrics, soundtrack, guide vocals and backing tracks.",
      "outputs": ["lyrics", "song_map", "demo_soundtrack_wav", "demo_soundtrack_mp3", "guide_vocals", "backing_tracks", "stems", "midi_files"],
      "priority": "P0"
    },
    {
      "feature_id": "arrangement_generation",
      "description": "Create musical arrangements for different group capabilities.",
      "outputs": ["piano_vocal_score", "full_score", "keyboard_only_arrangement", "small_band_arrangement", "school_band_arrangement", "operatic_society_arrangement", "tracks_only_pack", "instrument_parts"],
      "priority": "P0"
    },
    {
      "feature_id": "music_key_customisation",
      "description": "Allow musical numbers to be transposed and customised by vocal range or group setup.",
      "inputs": ["preferred_key", "vocal_range", "cast_role", "instrument_setup", "difficulty_level"],
      "outputs": ["transposed_score_pdf", "transposed_musicxml", "transposed_midi", "new_backing_track", "new_rehearsal_track"],
      "rules": ["Preserve original approved master version.", "Create a new version record for every key change.", "Run vocal range QA before export.", "Run score render QA before customer download.", "Warn if backing tracks need regeneration."],
      "priority": "P0"
    },
    {
      "feature_id": "no_code_customisation",
      "description": "Allow groups to customise without touching code.",
      "customisable_fields": ["group_name", "show_title", "venue_name", "performance_dates", "ticket_prices", "cast_names", "star_billing", "dame_name", "sponsor_names", "local_jokes", "local_landmarks", "rival_towns", "current_affairs_references", "poster_style", "website_theme", "ticketing_link", "social_handles"],
      "locked_fields": ["licence_terms", "copyright_notice", "rights_statement", "core_asset_ids", "payment_records", "approved_rights_status"],
      "priority": "P0"
    },
    {
      "feature_id": "custom_website_builder",
      "description": "Generate hosted or exportable websites for each group and show.",
      "outputs": ["hosted_show_site", "static_site_zip", "seo_metadata", "ticketing_page", "cast_page", "sponsor_page", "press_page", "gallery_page"],
      "priority": "P0"
    },
    {
      "feature_id": "site_hosting",
      "description": "Host customer show websites with customisable pages, ticket links and campaign tracking.",
      "hosting_modes": ["casper_subdomain", "custom_domain", "static_export", "embed_only"],
      "example_urls": ["shows.casper.example/group-name/show-title", "tickets.groupdomain.co.uk/show-title"],
      "priority": "P0"
    },
    {
      "feature_id": "marketing_pack_generation",
      "description": "Generate all printable and digital marketing materials.",
      "outputs": ["a3_poster", "a4_poster", "social_square", "social_story", "programme_template", "press_release", "sponsor_pack", "cast_announcement_graphics", "ticket_qr_graphics", "email_campaign_copy"],
      "priority": "P0"
    },
    {
      "feature_id": "cast_and_star_marketing",
      "description": "Automatically put stars, Dame, villain, principals and special guests into marketing assets.",
      "inputs": ["cast_member_name", "role_name", "billing_level", "bio", "photo", "social_handle", "special_guest_status"],
      "outputs": ["starring_copy", "cast_reveal_posts", "poster_billing", "website_cast_cards", "press_release_cast_section", "programme_bios"],
      "priority": "P0"
    },
    {
      "feature_id": "ticket_sales",
      "description": "Support ticket sales, reporting and marketing actions.",
      "modes": ["external_ticketing_link", "external_ticketing_embed", "native_casper_box_office"],
      "outputs": ["ticketing_page", "qr_tickets", "door_list", "sales_dashboard", "performance_sales_report", "weak_night_recommendations", "promo_code_tracking"],
      "priority": "P1"
    },
    {
      "feature_id": "customer_reporting",
      "description": "Give groups clear reports and recommended actions.",
      "reports": ["ticket_sales_report", "social_performance_report", "email_performance_report", "audience_growth_report", "press_outreach_report", "sponsor_engagement_report", "next_actions_report", "post_show_report"],
      "priority": "P0"
    }
  ],
  "core_workflows": [
    { "workflow_id": "admin_create_show", "name": "Admin creates new show pack", "steps": ["Create show brief", "Generate show bible", "Generate base script", "Generate script variants", "Generate song map if musical", "Generate lyrics", "Generate score drafts", "Generate demo soundtrack", "Generate arrangements", "Generate marketing templates", "Run rights and safety checks", "Approve for sale", "Publish to show library"] },
    { "workflow_id": "customer_buy_show", "name": "Customer buys a show pack", "steps": ["Browse show library", "Preview script sample", "Preview audio samples", "Choose licence tier", "Enter group and venue details", "Enter performance dates", "Choose ticketing option", "Pay", "Generate licence PDF", "Unlock download vault", "Create NemeSign customer campaign workspace", "Generate show website", "Generate marketing pack"] },
    { "workflow_id": "customer_customise_show", "name": "Customer customises show without code", "steps": ["Open customisation wizard", "Enter cast and star details", "Enter Dame billing", "Enter sponsors", "Enter local references", "Choose current affairs level", "Choose humour level", "Choose music key changes if required", "Preview changes", "Run safety and rights checks", "Generate updated assets", "Save as licensed custom version"] },
    { "workflow_id": "nemesign_promote_platform", "name": "NemeSign sells Show-in-a-Box to groups", "steps": ["Build prospect list", "Segment by group type", "Launch email sequence", "Launch paid ads", "Run SEO content plan", "Assign cold call tasks", "Score leads", "Book demos", "Send quotes", "Chase prospects", "Convert to paying customers", "Request testimonial after show"] },
    { "workflow_id": "nemesign_run_customer_campaign", "name": "NemeSign runs the customer's show marketing", "steps": ["Create audience CRM", "Import customer contacts if supplied", "Generate marketing calendar", "Generate launch announcement", "Generate cast reveal campaign", "Generate Dame/star campaign", "Generate sponsor campaign", "Publish website", "Connect ticketing", "Track ticket sales", "Detect weak performances", "Recommend actions", "Generate weekly report", "Generate post-show report", "Trigger renewal campaign"] }
  ],
  "data_entities": [
    { "entity": "show", "fields": ["show_id", "title", "slug", "show_type", "base_story", "audience_type", "status", "created_at", "updated_at"] },
    { "entity": "show_version", "fields": ["version_id", "show_id", "version_type", "cleanliness_level", "musical_status", "interactive_status", "approved_for_sale", "rights_status"] },
    { "entity": "song", "fields": ["song_id", "show_id", "title", "function", "style", "tempo", "default_key", "vocal_ranges", "rights_status", "approval_status"] },
    { "entity": "arrangement", "fields": ["arrangement_id", "song_id", "setup_type", "key", "difficulty", "musicxml_asset_id", "pdf_asset_id", "midi_asset_id", "audio_asset_id", "qa_status"] },
    { "entity": "customer_group", "fields": ["group_id", "name", "type", "contact_name", "email", "phone", "location", "social_handles", "crm_status"] },
    { "entity": "licence", "fields": ["licence_id", "group_id", "show_id", "version_id", "venue", "performance_dates", "performance_count", "seating_capacity", "licensed_assets", "video_permission", "streaming_permission", "customisation_permission", "created_at", "expires_at"] },
    { "entity": "campaign_workspace", "fields": ["workspace_id", "group_id", "licence_id", "show_id", "campaign_status", "ticketing_mode", "website_url", "created_at"] },
    { "entity": "ticket_performance", "fields": ["performance_id", "workspace_id", "date", "time", "venue", "capacity", "tickets_sold", "gross_revenue", "status"] },
    { "entity": "cast_member", "fields": ["cast_member_id", "workspace_id", "name", "role_name", "billing_level", "bio", "photo_asset_id", "social_handle", "marketing_approved"] },
    { "entity": "marketing_asset", "fields": ["asset_id", "workspace_id", "asset_type", "format", "status", "download_url", "created_at"] }
  ],
  "integrations": [
    { "name": "Stripe", "purpose": "Payments, subscriptions and ticketing checkout", "priority": "P0" },
    { "name": "ElevenLabs Music", "purpose": "AI music and demo soundtrack generation", "priority": "P0" },
    { "name": "Stable Audio", "purpose": "Alternative or fallback audio generation", "priority": "P1" },
    { "name": "music21", "purpose": "Symbolic music generation, transposition and arrangement logic", "priority": "P0" },
    { "name": "MuseScore CLI", "purpose": "Render MusicXML into PDF, MIDI and score exports", "priority": "P0" },
    { "name": "Flat.io", "purpose": "Customer-facing score preview and editing", "priority": "P1" },
    { "name": "Ticket Tailor", "purpose": "External ticketing embed and sales tracking", "priority": "P1" },
    { "name": "TicketSource", "purpose": "External ticketing link support for UK groups", "priority": "P1" },
    { "name": "Email provider", "purpose": "Transactional email and campaign sends", "priority": "P0" },
    { "name": "Social media APIs", "purpose": "Post scheduling and campaign reporting where permitted", "priority": "P2" },
    { "name": "Object storage", "purpose": "Store scripts, scores, audio, websites, posters and licence files", "priority": "P0" },
    { "name": "Static hosting platform", "purpose": "Host generated customer websites", "priority": "P0" }
  ],
  "api_routes": [
    { "method": "POST", "path": "/api/show-factory/shows", "purpose": "Create a new show brief" },
    { "method": "POST", "path": "/api/show-factory/shows/{show_id}/generate-bible", "purpose": "Generate show bible" },
    { "method": "POST", "path": "/api/show-factory/shows/{show_id}/generate-script", "purpose": "Generate script" },
    { "method": "POST", "path": "/api/show-factory/shows/{show_id}/generate-version", "purpose": "Generate adult, school, family or interactive version" },
    { "method": "POST", "path": "/api/show-factory/songs", "purpose": "Create song object" },
    { "method": "POST", "path": "/api/show-factory/songs/{song_id}/generate-audio", "purpose": "Generate demo audio" },
    { "method": "POST", "path": "/api/show-factory/songs/{song_id}/transpose", "purpose": "Create key-customised version" },
    { "method": "POST", "path": "/api/show-factory/arrangements", "purpose": "Generate arrangement pack" },
    { "method": "POST", "path": "/api/licensing/create", "purpose": "Create licence after checkout" },
    { "method": "POST", "path": "/api/customer-workspaces", "purpose": "Create customer NemeSign campaign workspace" },
    { "method": "POST", "path": "/api/customer-workspaces/{workspace_id}/customise", "purpose": "Apply no-code customer customisations" },
    { "method": "POST", "path": "/api/customer-workspaces/{workspace_id}/generate-website", "purpose": "Generate hosted customer website" },
    { "method": "POST", "path": "/api/customer-workspaces/{workspace_id}/generate-marketing-pack", "purpose": "Generate posters, press, social and email assets" },
    { "method": "POST", "path": "/api/customer-workspaces/{workspace_id}/ticketing/connect", "purpose": "Connect native or external ticketing" },
    { "method": "GET", "path": "/api/customer-workspaces/{workspace_id}/reports", "purpose": "Return campaign, ticketing and action reports" }
  ],
  "build_phases": [
    { "phase": 1, "name": "Foundation MVP", "duration_weeks": 4, "goal": "Create sellable Show-in-a-Box product with licence, downloads, basic website and marketing pack.", "tasks": ["Create database schema", "Create admin show builder", "Create show brief form", "Create show bible generator", "Create script generator", "Create version generator", "Create asset vault", "Create checkout flow", "Create licence PDF generator", "Create customer download portal", "Create basic website generator", "Create basic poster and press release generator"], "acceptance_criteria": ["Admin can create and approve one show.", "Customer can buy one show pack.", "Licence PDF is generated automatically.", "Customer can download script and marketing assets.", "Customer gets a hosted show page."] },
    { "phase": 2, "name": "NemeSign Sales Engine", "duration_weeks": 3, "goal": "Enable NemeSign to promote Show-in-a-Box to groups.", "tasks": ["Create prospect database", "Create CRM pipeline", "Create cold email sequence builder", "Create cold call task board", "Create lead scoring", "Create sales reporting dashboard", "Create quote and follow-up workflow", "Create testimonial capture workflow"], "acceptance_criteria": ["Prospects can be imported and segmented.", "Sales sequences can be launched.", "Calls and follow-ups are tracked.", "Conversions are reported."] },
    { "phase": 3, "name": "Music and Arrangement Engine", "duration_weeks": 6, "goal": "Generate musical pack assets, including score, demo soundtrack and key customisation.", "tasks": ["Create song map generator", "Create lyric generator", "Integrate ElevenLabs Music", "Integrate Stable Audio fallback", "Create music21 symbolic music service", "Create MusicXML export", "Create MuseScore CLI render service", "Create piano-vocal score output", "Create arrangement presets", "Create key transposition workflow", "Create backing track export", "Create music QA checks"], "acceptance_criteria": ["System can create a song with lyrics, score and demo audio.", "System can export PDF score, MusicXML and MIDI.", "System can transpose a song to a chosen key.", "System can create at least piano-only and tracks-only packs."] },
    { "phase": 4, "name": "Customer Campaign Engine", "duration_weeks": 5, "goal": "Let NemeSign run each customer's own marketing and audience engagement.", "tasks": ["Create customer campaign workspace", "Create audience CRM", "Create cast and star marketing module", "Create Dame billing module", "Create social content generator", "Create email campaign generator", "Create press outreach pack", "Create sponsor campaign module", "Create action recommendations", "Create weekly report generator"], "acceptance_criteria": ["Customer can enter cast, star and Dame details.", "System generates campaign assets using those details.", "System produces weekly actions and reports.", "Customer can download or publish marketing assets."] },
    { "phase": 5, "name": "Ticketing and Box Office", "duration_weeks": 5, "goal": "Support ticket sales and ticket-driven marketing.", "tasks": ["Create external ticket link support", "Create ticketing embed blocks", "Create QR code generator", "Create ticket sales dashboard", "Create native box office MVP", "Create ticket types", "Create promo codes", "Create comp tickets", "Create door list export", "Create weak-night recommendation engine"], "acceptance_criteria": ["Customer can add ticket links or embeds.", "Generated website includes ticketing.", "Ticket QR codes can be placed on posters.", "Native box office can sell general admission tickets.", "Dashboard shows sold, remaining and gross revenue."] },
    { "phase": 6, "name": "Scale and Automation", "duration_weeks": 8, "goal": "Add renewals, subscriptions, advanced reporting and scalable hosting.", "tasks": ["Create annual library subscription", "Create renewal campaigns", "Create post-show review collection", "Create audience retention flows", "Create multi-show customer accounts", "Create reserved seating planning", "Create advanced analytics", "Create human review marketplace", "Create custom domain support", "Create automated current affairs update packs"], "acceptance_criteria": ["Groups can renew or buy next year's show.", "Post-show reports are generated.", "Audience lists can be retained for future campaigns.", "Custom domains can be connected.", "Advanced campaign analytics are available."] }
  ],
  "quality_gates": [
    { "gate": "rights_safety_gate", "checks": ["No uncleared copyrighted lyrics", "No imitation of named living artist", "No unlicensed chart-song arrangement", "No defamatory local claims", "No adult content in school version", "No protected-characteristic abuse", "Current affairs references have source snapshot and expiry date"] },
    { "gate": "script_quality_gate", "checks": ["Scene continuity", "Character consistency", "Runtime estimate", "Version separation", "Audience suitability", "Cast-size feasibility"] },
    { "gate": "music_quality_gate", "checks": ["Vocal range safe", "Key suitable", "Score renders successfully", "MIDI exports successfully", "Backing track aligns with score", "Arrangement matches selected setup", "No impossible instrumental parts"] },
    { "gate": "marketing_quality_gate", "checks": ["Correct group name", "Correct venue", "Correct dates", "Correct ticket link", "Cast names approved", "Sponsor names approved", "Poster exports correctly", "Website preview approved"] }
  ],
  "user_roles": [
    { "role": "platform_admin", "permissions": ["create_show", "approve_show", "manage_licences", "manage_customers", "view_all_reports", "override_assets"] },
    { "role": "rights_reviewer", "permissions": ["review_rights_flags", "approve_rights", "reject_assets", "lock_versions"] },
    { "role": "music_reviewer", "permissions": ["review_scores", "review_audio", "approve_arrangements", "request_regeneration"] },
    { "role": "customer_admin", "permissions": ["edit_group_details", "customise_allowed_fields", "download_assets", "publish_website", "connect_ticketing", "view_reports"] },
    { "role": "customer_marketer", "permissions": ["edit_campaign_assets", "schedule_posts", "send_email_campaigns", "view_campaign_reports"] }
  ],
  "environment_requirements": {
    "frontend": ["Admin dashboard", "Customer portal", "No-code website builder", "Campaign workspace", "Download vault"],
    "backend": ["API server", "Job queue", "Asset rendering workers", "Music rendering workers", "Audio generation workers", "Report generation workers"],
    "storage": ["Relational database", "Object storage", "Search index", "Audit log storage"],
    "hosting": ["Application hosting", "Static site hosting", "CDN", "Custom domain support", "SSL certificate automation"]
  },
  "deployment_instructions": [
    "Deploy core app and API first.",
    "Deploy object storage and asset vault.",
    "Deploy worker queue for long-running generation tasks.",
    "Deploy website hosting service for customer microsites.",
    "Deploy Stripe checkout and licence generation.",
    "Deploy NemeSign CRM and outreach module.",
    "Deploy music workers separately to prevent audio or score generation failures from affecting checkout.",
    "Deploy ticketing as a separate service boundary.",
    "Enable audit logs for every licence, customisation, rights approval and asset download.",
    "Do not allow customer downloads until licence payment and rights status are valid."
  ],
  "implementation_rules": [
    "Everything customer-facing must be no-code.",
    "Every generated asset must have an asset_id, version_id and approval_status.",
    "Every licence must lock the exact show version purchased.",
    "Every customer customisation must create a new version record.",
    "Music key changes must never overwrite the master score.",
    "Current affairs jokes must include generated_at and expires_at dates.",
    "Marketing assets must always pull from approved customer data.",
    "Ticketing links must be validated before posters or websites are published.",
    "Adult and school-safe versions must remain separated.",
    "No third-party song, lyric, melody or arrangement may be included without explicit rights clearance."
  ],
  "success_metrics": {
    "platform_sales": ["number_of_leads", "lead_to_demo_rate", "demo_to_sale_rate", "customer_acquisition_cost", "average_order_value", "monthly_recurring_revenue", "renewal_rate"],
    "customer_campaigns": ["tickets_sold", "gross_ticket_revenue", "email_open_rate", "email_click_rate", "social_engagement", "website_visits", "conversion_rate", "weak_performance_recovery", "audience_list_growth"],
    "product_quality": ["asset_generation_success_rate", "score_render_success_rate", "audio_generation_success_rate", "support_tickets_per_customer", "refund_rate", "rights_flags_per_show", "customer_satisfaction_score"]
  },
  "initial_flagship_show_requirement": {
    "goal": "Build one complete flagship panto to prove the system.",
    "required_assets": ["family_script", "adult_script", "school_script", "interactive_script", "non_musical_script", "musical_script", "8_original_songs", "piano_vocal_score", "tracks_only_pack", "small_band_arrangement", "key_customisable_music", "demo_soundtrack", "backing_tracks", "poster_pack", "programme_template", "press_release", "social_campaign", "hosted_website", "ticketing_page", "licence_pdf", "download_vault", "NemeSign_campaign_workspace"]
  },
  "three_year_business_plan_targets": {
    "year_1": { "target_customers": { "low": 40, "base": 75, "high": 120 }, "target_turnover_gbp": { "low": 60000, "base": 100000, "high": 180000 }, "main_goal": "Prove product, get testimonials, make first renewals possible." },
    "year_2": { "target_customers": { "low": 120, "base": 220, "high": 350 }, "target_turnover_gbp": { "low": 180000, "base": 300000, "high": 550000 }, "main_goal": "Scale catalogue, subscriptions and ticketing." },
    "year_3": { "target_customers": { "low": 250, "base": 500, "high": 800 }, "target_turnover_gbp": { "low": 400000, "base": 750000, "high": 1200000 }, "main_goal": "Become the operating system for small-scale amateur theatre production and marketing." }
  },
  "immediate_next_actions": [
    "Build one flagship show pack.",
    "Build the checkout and licence generator.",
    "Build customer download vault.",
    "Build hosted website generator.",
    "Build NemeSign sales CRM.",
    "Build customer campaign workspace.",
    "Add cast, star and Dame marketing fields.",
    "Add external ticketing link and QR code support.",
    "Add music key customisation in the arrangement engine.",
    "Run pilot with 5 to 10 real groups before scaling paid ads."
  ]
} as const;

export type CasperShowInABoxModel = typeof casperShowInABoxModel;

export const casperShowInABoxPhaseIds = [2, 3, 4, 5] as const;

export function getCasperShowInABoxPhases(ids: readonly number[] = casperShowInABoxPhaseIds) {
  return casperShowInABoxModel.build_phases.filter((phase) => ids.includes(phase.phase));
}

export function getCasperShowInABoxSummary() {
  const phases = getCasperShowInABoxPhases();
  return {
    project_name: casperShowInABoxModel.project_name,
    version: casperShowInABoxModel.version,
    objective: casperShowInABoxModel.objective,
    core_positioning: casperShowInABoxModel.core_positioning,
    target_users: casperShowInABoxModel.target_users,
    revenue_streams: casperShowInABoxModel.commercial_model.revenue_streams.map((stream) => stream.name),
    module_count: casperShowInABoxModel.system_modules.length,
    p0_feature_count: casperShowInABoxModel.must_have_features.filter((feature) => feature.priority === 'P0').length,
    selected_phases: phases.map((phase) => ({ phase: phase.phase, name: phase.name, duration_weeks: phase.duration_weeks, task_count: phase.tasks.length }))
  };
}
