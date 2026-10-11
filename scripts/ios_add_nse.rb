#!/usr/bin/env ruby
# frozen_string_literal: true

# ============================================================
# Inyecta la Notification Service Extension (logo de Onyx en el push de iOS) en
# el proyecto Xcode que Capacitor genera en ios/App/App.xcodeproj.
#
# Por qué por script: la carpeta ios/ está en .gitignore y se regenera en cada
# build (cap add/sync ios), así que no hay un .xcodeproj versionado donde añadir
# el target a mano. Este script lo añade de forma idempotente DESPUÉS de
# `npx cap sync ios` y ANTES de `pod install` / el archivado.
#
# Requisitos: ruby + gema `xcodeproj` (ya presente en runners macOS de Codemagic
# porque CocoaPods depende de ella). Si faltara: `gem install xcodeproj`.
#
# Variables de entorno usadas (opcionales):
#   DEVELOPMENT_TEAM  → Team ID de Apple (10 chars). Con firma automática en
#                       Codemagic normalmente no hace falta, pero si lo defines
#                       lo escribimos en el target de la extensión.
# ============================================================

require 'xcodeproj'
require 'fileutils'

ROOT       = File.expand_path('..', __dir__)          # raíz del repo
IOS_APP    = File.join(ROOT, 'ios', 'App')            # SRCROOT del proyecto
PROJECT    = File.join(IOS_APP, 'App.xcodeproj')
SRC_DIR    = File.join(ROOT, 'ios-native', 'OnyxNotificationService')
NSE_NAME   = 'OnyxNotificationService'
DEST_DIR   = File.join(IOS_APP, NSE_NAME)             # ios/App/OnyxNotificationService

abort("✗ No existe #{PROJECT}. Corre `npx cap add ios` / `npx cap sync ios` antes.") unless Dir.exist?(PROJECT)
abort("✗ No existen los fuentes en #{SRC_DIR}.") unless File.exist?(File.join(SRC_DIR, 'NotificationService.swift'))

proj = Xcodeproj::Project.open(PROJECT)

# Idempotente: si ya existe el target, no hacemos nada (p. ej. 2º build).
if proj.targets.any? { |t| t.name == NSE_NAME }
  puts "✓ El target #{NSE_NAME} ya existe. Nada que hacer."
  exit 0
end

app_target = proj.targets.find { |t| t.name == 'App' }
abort('✗ No encontré el target "App".') unless app_target

# Bundle id de la app (para derivar el de la extensión).
app_cfg    = app_target.build_configurations.find { |c| c.name == 'Release' } || app_target.build_configurations.first
app_bundle = app_cfg.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] || 'com.onyxtradinglive.app'
app_bundle = 'com.onyxtradinglive.app' if app_bundle.to_s.include?('$') # por si viene como variable
nse_bundle = "#{app_bundle}.#{NSE_NAME}"
deploy     = app_cfg.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] || '13.0'
swift_ver  = app_cfg.build_settings['SWIFT_VERSION'] || '5.0'
team       = ENV['DEVELOPMENT_TEAM'] || app_cfg.build_settings['DEVELOPMENT_TEAM']

# 1) Copiar los fuentes dentro del proyecto iOS.
FileUtils.mkdir_p(DEST_DIR)
FileUtils.cp(File.join(SRC_DIR, 'NotificationService.swift'), DEST_DIR)
FileUtils.cp(File.join(SRC_DIR, 'Info.plist'), DEST_DIR)

# 2) Crear el target de tipo app_extension.
nse = proj.new_target(:app_extension, NSE_NAME, :ios, deploy)

# 3) Grupo + referencias de archivo.
group = proj.main_group.find_subpath(NSE_NAME, true)
group.set_source_tree('SOURCE_ROOT')
swift_ref = group.new_reference(File.join(NSE_NAME, 'NotificationService.swift'))
group.new_reference(File.join(NSE_NAME, 'Info.plist'))

# 4) Fase de compilación (Sources) con el .swift.
nse.source_build_phase.add_file_reference(swift_ref)

# 5) Build settings de la extensión.
nse.build_configurations.each do |cfg|
  s = cfg.build_settings
  s['PRODUCT_BUNDLE_IDENTIFIER']   = nse_bundle
  s['PRODUCT_NAME']                = '$(TARGET_NAME)'
  s['INFOPLIST_FILE']              = "#{NSE_NAME}/Info.plist"
  s['IPHONEOS_DEPLOYMENT_TARGET']  = deploy
  s['SWIFT_VERSION']               = swift_ver
  s['TARGETED_DEVICE_FAMILY']      = '1,2'
  # Firma MANUAL (igual que el target App): Codemagic asigna el perfil correcto
  # por bundle id con `xcode-project use-profiles`. Para ello debe existir un
  # provisioning profile de distribución para el App ID de la extensión
  # (com.onyxtradinglive.app.OnyxNotificationService) y estar listado en el yaml.
  s['CODE_SIGN_STYLE']             = 'Manual'
  s['GENERATE_INFOPLIST_FILE']     = 'NO'
  s['SKIP_INSTALL']                = 'YES'
  s['CURRENT_PROJECT_VERSION']     = app_cfg.build_settings['CURRENT_PROJECT_VERSION'] || '1'
  s['MARKETING_VERSION']           = app_cfg.build_settings['MARKETING_VERSION'] || '1.0'
  s['DEVELOPMENT_TEAM']            = team if team && !team.to_s.empty?
  s['LD_RUNPATH_SEARCH_PATHS']     = ['$(inherited)', '@executable_path/Frameworks', '@executable_path/../../Frameworks']
end

# 6) Incrustar la extensión en la app (dependencia + "Embed App Extensions").
app_target.add_dependency(nse)
embed = app_target.copy_files_build_phases.find { |p| p.name == 'Embed App Extensions' }
embed ||= app_target.new_copy_files_build_phase('Embed App Extensions')
embed.symbol_dst_subfolder_spec = :plug_ins   # carpeta PlugIns (app extensions)
ref = embed.add_file_reference(nse.product_reference, true)
ref.settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }

proj.save
puts "✓ Extensión #{NSE_NAME} añadida (bundle: #{nse_bundle}, deploy: #{deploy})."
